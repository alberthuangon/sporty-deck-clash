<template>
  <div class="mt">
    <div v-if="ctx.replay" class="replay-bar">REPLAY — nothing is being settled</div>
    <Stage
      ref="stageRef"
      :home="teams.home" :away="teams.away"
      :home-name="homeName" :away-name="awayName"
      :home-is-me="matchView.aIsHome"
    />

    <div class="feed scroll" ref="feedEl">
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'
import Stage from '../match/Stage.vue'
import { store, go, ctx, matchView, finishMatch, endReplay } from '../game.js'
import { compileMatch, resetStage, startIdle, stopIdle } from '../match/player.js'
import { BEAT } from '../match/stageModel.js'

const stageRef = ref(null)
const feedEl = ref(null)
const feed = ref([])
const finished = ref(false)
let compiled = null

const teams = computed(() => ({
  home: ctx.result ? ctx.result.home : ctx.playerTeam,
  away: ctx.result ? ctx.result.away : ctx.playerTeam
}))
const homeName = computed(() => matchView.aIsHome ? 'You' : matchView.opponentName)
const awayName = computed(() => matchView.aIsHome ? matchView.opponentName : 'You')

function who (side) { return side === 'HOME' ? homeName.value : awayName.value }

function describe (e) {
  if (e.round) {
    return {
      when: 'R' + e.round,
      text: `${who(e.side)} — ${e.shooterName} vs ${e.keeperName}: ${e.outcome}` +
        (e.suddenDeath ? ' (sudden death)' : ''),
      cls: e.outcome === 'GOAL' ? 'goal' : ''
    }
  }
  const w = who(e.side)
  const map = {
    KICK_OFF: ['Kick off', 'meta'],
    HALF_TIME: ['Half time', 'meta'],
    FULL_TIME: ['Full time', 'meta'],
    GOAL: [`GOAL — ${e.actorName} (${w})`, 'goal'],
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
  startIdle(api, BEAT.idle)

  const onSfx = () => {}          // step 8 maps these labels to audio files
  const onRate = (rate) => {
    if (!compiled) return
    gsap.to(compiled.timeline, { timeScale: rate * baseRate.value, duration: .12, ease: 'power2.out' })
  }

  compiled = compileMatch(api, ctx.script, ctx.result, BEAT, {
    onSfx, onRate, onEvent: push, onEnd: () => { finished.value = true }
  })

  // compileMatch already applied any cap compression; fast match multiplies it
  capScale.value = compiled.timeline.timeScale()
  compiled.timeline.timeScale(baseRate.value)
  compiled.timeline.play()
  if (import.meta.env.DEV) {
    window.__match = compiled
    console.log('[skd] compiled match: timeline %ss, expected wall %ss, played %ss, cap scale %s',
      compiled.rawDuration.toFixed(2), compiled.expectedDuration.toFixed(2),
      compiled.playedDuration.toFixed(2), capScale.value.toFixed(3))
  }
})

const capScale = ref(1)
const baseRate = computed(() => capScale.value * (store.settings.fastMatch ? 3 : 1))

onUnmounted(() => {
  if (compiled) compiled.timeline.kill()
  stopIdle()
})

function skip () {
  if (!compiled) return
  compiled.timeline.progress(1)
  finished.value = true
}

function toResult () {
  if (ctx.replay) { endReplay(); return }    // settles nothing, scores nothing
  finishMatch()
  go('result')
}
</script>

<style scoped>
.mt { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.replay-bar {
  background: var(--r-l); color: #2A1C00; text-align: center;
  font-size: 10px; font-weight: 800; letter-spacing: .1em; padding: 4px;
}
.feed { flex: 1; padding: 6px 12px 0; min-height: 0; }
.ev { display: flex; gap: 8px; font-size: 12px; padding: 5px 0; border-bottom: 1px solid var(--divider); }
.ev.goal { color: var(--green); font-weight: 700; }
.ev.meta { color: var(--text-3); }
.em { width: 34px; flex: 0 0 34px; font-variant-numeric: tabular-nums; color: var(--text-2); }
.ctrl { display: flex; gap: 8px; padding: 10px 12px; }
.ctrl .btn { flex: 1; }
</style>
