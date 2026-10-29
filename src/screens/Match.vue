<template>
  <div class="mt" :inert="celebrating || undefined">
    <div v-if="ctx.replay" class="replay-bar">REPLAY — nothing is being settled</div>
    <Stage v-show="!finished"
      ref="stageRef"
      :home="teams.home" :away="teams.away"
      :home-name="homeName" :away-name="awayName"
      :home-is-me="matchView.aIsHome"
    />

    <template v-if="!finished">
    <div class="feed-title"><span>{{ finished ? 'MATCH HIGHLIGHTS' : 'LIVE COMMENTARY' }}</span><span class="live-indicator" :class="{ ended: finished }">{{ finished ? 'FULL TIME' : '● LIVE' }}</span></div>
    <div class="feed scroll" ref="feedEl" role="log" aria-label="Match commentary">
      <div v-for="(e,i) in feed" :key="i" class="ev" :class="e.cls">
        <span class="em">{{ e.when }}</span>
        <span class="et">{{ e.text }}</span>
      </div>
    </div>

    <div class="ctrl">
      <button class="btn" :disabled="finished" @click="skip">Skip</button>
      <button class="btn btn-cta" :disabled="!finished" @click="toResult">
        {{ ctx.replay ? 'Done' : 'Result' }}
      </button>
    </div>
    </template>
    <MatchSummary v-if="finished && !celebrating" :match="matchView" :script="summaryScript"
                  :home-name="homeName" :away-name="awayName" :replay="summaryReplay" :busy="proceeding" @proceed="toResult" />
    <VictoryCelebration v-if="celebrating" :replay="summaryReplay" @done="celebrating = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import gsap from 'gsap'
import Stage from '../match/Stage.vue'
import MatchSummary from '../components/MatchSummary.vue'
import VictoryCelebration from '../components/VictoryCelebration.vue'
import { store, go, ctx, matchView, finishMatch, endReplay } from '../game.js'
import { compileMatch, resetStage, startIdle, stopIdle } from '../match/player.js'
import { reduced } from '../ui/motion.js'
import { BEAT } from '../match/stageModel.js'

const stageRef = ref(null)
const feedEl = ref(null)
const feed = ref([])
const finished = ref(false)
const celebrating = ref(false)
const summaryScript = ref(null)
const summaryReplay = ref(false)
const proceeding = ref(false)
let suppressCelebration = false
function completePresentation () {
  if (finished.value) return
  summaryScript.value = ctx.script
  summaryReplay.value = ctx.replay
  stopIdle()
  finished.value = true
  celebrating.value = matchView.won && !suppressCelebration && !reduced.value
}
let compiled = null
let protectedPacing = false

const teams = computed(() => ({
  home: ctx.result ? ctx.result.home : ctx.playerTeam,
  away: ctx.result ? ctx.result.away : ctx.playerTeam
}))
const homeName = computed(() => matchView.aIsHome ? 'You' : matchView.opponentName)
const awayName = computed(() => matchView.aIsHome ? matchView.opponentName : 'You')

function who (side) { return side === 'HOME' ? homeName.value : awayName.value }
/* Which team the line belongs to. The feed used to paint EVERY goal mint
   green, so the opponent scoring against you read as something good — the
   same complaint Albert made about the pitch, in the text column. There is no
   "good" in a match feed, only who did it. */
function side (e) { return e.side === 'HOME' ? 'home' : 'away' }

function describe (e) {
  if (e.round) {
    return {
      when: 'R' + e.round,
      text: `${who(e.side)} — ${e.shooterName} vs ${e.keeperName}: ${e.outcome}` +
        (e.suddenDeath ? ' (sudden death)' : ''),
      cls: e.outcome === 'GOAL' ? 'goal ' + side(e) : ''
    }
  }
  const w = who(e.side)
  const map = {
    KICK_OFF: ['Kick off', 'meta'],
    HALF_TIME: ['Half time', 'meta'],
    FULL_TIME: ['Full time', 'meta'],
    GOAL: [`GOAL — ${e.actorName} (${w})`, 'goal ' + side(e)],
    SHOT_SAVE: [`${e.actorName} shoots, ${e.keeperName} saves`, ''],
    SHOT_OFF: [`${e.actorName} shoots wide`, ''],
    SHOT_POST: [`${e.actorName} hits the post`, ''],
    TACKLED: [`${e.actorName} tackled in the box`, '']
  }
  const [text, cls] = map[e.type] || [e.type, '']
  return { when: e.minute + "'", text, cls }
}

function push (e) {
  feed.value.unshift(describe(e))
}

onMounted(async () => {
  if (!ctx.script) { go('home'); return }
  await nextTick()
  const api = stageRef.value && stageRef.value.api
  if (!api) return

  resetStage(api)
  if (!reduced.value) startIdle(api, BEAT.idle)

  const onSfx = () => {}          // step 8 maps these labels to audio files
  const onRate = (rate) => {
    if (!compiled) return
    gsap.to(compiled.timeline, { timeScale: rate * (protectedPacing ? 1 : baseRate.value), duration: .12, ease: 'power2.out', overwrite: true })
  }
  const onPacing = (protectedPhase) => {
    protectedPacing = protectedPhase
    if (!compiled) return
    gsap.killTweensOf(compiled.timeline)
    compiled.timeline.timeScale(protectedPhase ? 1 : baseRate.value)
    if (protectedPhase) stopIdle()
  }

  compiled = compileMatch(api, ctx.script, ctx.result, BEAT, {
    onSfx, onRate, onPacing, showFinal: false, onEvent: push, onEnd: completePresentation
  })

  // compileMatch already applied any cap compression; fast match multiplies it
  capScale.value = compiled.timeline.timeScale()
  compiled.timeline.timeScale(baseRate.value)
  if (reduced.value) skip()
  else compiled.timeline.play()
  /* the compiled timeline is the hatch tools/layout drives to reach a cut-in,
     and the one Claude in Chrome scrubs by hand — same reasoning as __skd */
  window.__match = compiled
  window.__ctx = ctx
  if (import.meta.env.DEV) {
    console.log('[skd] compiled match: timeline %ss, expected wall %ss, played %ss, cap scale %s',
      compiled.rawDuration.toFixed(2), compiled.expectedDuration.toFixed(2),
      compiled.playedDuration.toFixed(2), capScale.value.toFixed(3))
  }
})

const capScale = ref(1)
const baseRate = computed(() => capScale.value * (store.settings.fastMatch ? 3 : 1))

onUnmounted(() => {
  if (compiled) { gsap.killTweensOf(compiled.timeline); compiled.timeline.kill() }
  stopIdle()
})

function skip () {
  if (!compiled) return
  // Skip ends live play, but a live win still gets its celebration.
  suppressCelebration = ctx.replay
  if (finished.value) { celebrating.value = false; return }
  gsap.killTweensOf(compiled.timeline)
  compiled.timeline.progress(1, false).pause()
  gsap.killTweensOf(compiled.timeline)
  // rebuild the feed from the script rather than relying on which callbacks
  // the jump happened to pass, and set the terminal state from data
  feed.value = []
  ctx.script.events.forEach(push)
  if (ctx.script.penalty) ctx.script.penalty.events.forEach(push)
  compiled.applyEnd()
  completePresentation()
}

watch(reduced, value => { if (value && compiled) { stopIdle(); skip() } })

function toResult () {
  if (proceeding.value || !finished.value || celebrating.value) return
  proceeding.value = true
  if (summaryReplay.value) { endReplay(); return }    // settles nothing, scores nothing
  finishMatch()
  go('result')
}
</script>

<style scoped>
.mt {
  flex:1;
  display:flex;
  flex-direction:column;
  min-height:0;
  background:linear-gradient(180deg,#111b27,#10151e);
}
.replay-bar {
  background:#e9ca7c;
  color:#33280d;
  text-align:center;
  font-size:10px;
  font-weight:800;
  letter-spacing:.1em;
  padding:7px;
}
.feed-title {
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:17px 18px 10px;
  font-size:10px;
  font-weight:800;
  letter-spacing:.12em;
  color:#a8bdcc;
  border-top:1px solid #8296b126;
}
.live-indicator {
  font-size:9px;
  color:#75e7a2;
  letter-spacing:.06em;
}
.live-indicator.ended {
  color:#b9c5d1;
}
.feed {
  flex:1;
  min-height:0;
  padding:0 18px 12px;
}
.ev {
  display:flex;
  gap:12px;
  font-size:12px;
  padding:11px 0;
  border-bottom:1px solid #ffffff0b;
  line-height:1.5;
}
.ev.goal {
  font-weight:700;
}
.ev.goal.home {
  color:var(--home-on);
}
.ev.goal.away {
  color:var(--away-on);
}
.ev.meta {
  color:#94a6b6;
}
.em {
  width:34px;
  flex:none;
  font-weight:800;
  font-size:10px;
  color:#93a9ba;
  font-variant-numeric:tabular-nums;
  padding-top:2px;
}
.et {
  flex:1;
  min-width:0;
}
.ctrl {
  display:flex;
  gap:10px;
  padding:14px 18px 18px;
  background:#141e2b;
  border-top:1px solid #8394aa25;
}
.ctrl .btn {
  flex:1;
  border-radius:12px;
}
.ctrl .btn:first-child {
  flex:.65;
  background:transparent;
  border:1px solid #7b8eaa66;
}
.feed { scrollbar-width: none; }
.feed::-webkit-scrollbar { display: none; }
</style>
