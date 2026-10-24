<template>
  <div class="mt">
    <div class="board">
      <div class="team" :class="{ me: matchView.aIsHome }">
        <span class="tn">{{ homeName }}</span>
        <span class="badge">H</span>
      </div>
      <div class="score">{{ shownHome }} : {{ shownAway }}</div>
      <div class="team right" :class="{ me: !matchView.aIsHome }">
        <span class="badge away">A</span>
        <span class="tn">{{ awayName }}</span>
      </div>
    </div>
    <div class="clock">{{ phase === 'pk' ? 'PENALTIES' : clock + "'" }}</div>

    <!-- grey-box pitch: step 4/5 replace this with the attack-wave stage -->
    <div class="pitch">
      <div class="half"></div>
      <div class="circle"></div>
      <div v-for="t in tokens" :key="t.id" class="token" :class="t.side"
           :style="{ left: t.x + '%', top: t.y + '%' }">{{ t.label }}</div>
    </div>

    <div class="feed scroll">
      <div v-for="(e,i) in shownEvents" :key="i" class="ev" :class="evClass(e)">
        <span class="em">{{ e.round ? ('R' + e.round) : (e.minute + "'") }}</span>
        <span class="et">{{ describe(e) }}</span>
      </div>
    </div>

    <div class="ctrl">
      <button class="btn" @click="skip">Skip</button>
      <button v-if="finished" class="btn btn-cta" @click="toResult">Result</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { store, go, ctx, matchView, finishMatch } from '../game.js'

const clock = ref(0)
const shownEvents = ref([])
const shownHome = ref(0)
const shownAway = ref(0)
const phase = ref('regular')
const finished = ref(false)
let timer = null

const homeName = computed(() => matchView.aIsHome ? 'You' : matchView.opponentName)
const awayName = computed(() => matchView.aIsHome ? matchView.opponentName : 'You')

const tokens = computed(() => {
  const h = ctx.result ? ctx.result.home : null
  const a = ctx.result ? ctx.result.away : null
  if (!h || !a) return []
  const mk = (team, side, xs) => ['gk', 'df', 'mf', 'fw'].map((k, i) => ({
    id: side + k, side, label: team.cards[k].name.slice(0, 2),
    x: xs[i], y: [50, 30, 62, 42][i]
  }))
  return [...mk(h, 'home', [8, 26, 40, 54]), ...mk(a, 'away', [92, 74, 60, 46])]
})

const speed = computed(() => store.settings.fastMatch ? 3 : 1)

onMounted(() => {
  if (!ctx.script) { go('home'); return }
  run()
})
onUnmounted(() => clearInterval(timer))

function run () {
  const evs = ctx.script.events
  let i = 0
  timer = setInterval(() => {
    clock.value = Math.min(90, clock.value + 1)
    while (i < evs.length && evs[i].minute <= clock.value) {
      apply(evs[i]); i++
    }
    if (clock.value >= 90 && i >= evs.length) {
      clearInterval(timer)
      startPk()
    }
  }, 480 / speed.value)
}

function apply (e) {
  shownEvents.value.unshift(e)
  if (e.type === 'GOAL') {
    if (e.side === 'HOME') shownHome.value++
    else shownAway.value++
  }
}

function startPk () {
  if (!ctx.script.penalty) { finished.value = true; return }
  phase.value = 'pk'
  let i = 0
  const pes = ctx.script.penalty.events
  timer = setInterval(() => {
    if (i >= pes.length) { clearInterval(timer); finished.value = true; return }
    shownEvents.value.unshift(pes[i])
    i++
  }, 900 / speed.value)
}

function skip () {
  clearInterval(timer)
  clock.value = 90
  shownHome.value = matchView.homeScore
  shownAway.value = matchView.awayScore
  const all = [...ctx.script.events]
  if (ctx.script.penalty) { phase.value = 'pk'; all.push(...ctx.script.penalty.events) }
  shownEvents.value = all.slice().reverse()
  finished.value = true
}

function toResult () { finishMatch(); go('result') }

function describe (e) {
  if (e.round) {
    const who = e.side === 'HOME' ? homeName.value : awayName.value
    return `${who} — ${e.shooterName} vs ${e.keeperName}: ${e.outcome}${e.suddenDeath ? ' (sudden death)' : ''}`
  }
  const who = e.side === 'HOME' ? homeName.value : awayName.value
  switch (e.type) {
    case 'KICK_OFF': return 'Kick off'
    case 'HALF_TIME': return 'Half time'
    case 'FULL_TIME': return 'Full time'
    case 'GOAL': return `GOAL — ${e.actorName} (${who})`
    case 'SHOT_SAVE': return `${e.actorName} shoots, ${e.keeperName} saves`
    case 'SHOT_OFF': return `${e.actorName} shoots wide`
    case 'SHOT_POST': return `${e.actorName} hits the post`
    case 'TACKLED': return `${e.actorName} tackled in the box`
    default: return e.type
  }
}
function evClass (e) {
  if (e.type === 'GOAL' || e.outcome === 'GOAL') return 'goal'
  if (['KICK_OFF', 'HALF_TIME', 'FULL_TIME'].includes(e.type)) return 'meta'
  return ''
}
</script>

<style scoped>
.mt { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.board {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface); padding: 10px 12px; gap: 8px;
}
.team { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.team.right { justify-content: flex-end; }
.tn { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.team.me .tn { color: var(--green); }
.badge { font-size: 9px; font-weight: 800; background: var(--home); border-radius: 3px; padding: 1px 4px; }
.badge.away { background: var(--away); }
.score { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
.clock { text-align: center; font-size: 12px; font-weight: 700; color: var(--text-2); padding: 4px; background: var(--surface-lo); }
.pitch {
  position: relative; height: 150px; margin: 10px 12px; border-radius: 6px;
  background: linear-gradient(180deg, #1E3A24, #16291A);
  border: 1px solid rgba(255,255,255,.12);
}
.half { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,.18); }
.circle { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px; border: 1px solid rgba(255,255,255,.18); border-radius: 50%; }
.token {
  position: absolute; transform: translate(-50%,-50%);
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; font-weight: 800; color: #fff;
}
.token.home { background: var(--home); }
.token.away { background: var(--away); }
.feed { flex: 1; padding: 0 12px; min-height: 0; }
.ev { display: flex; gap: 8px; font-size: 12px; padding: 6px 0; border-bottom: 1px solid var(--divider); }
.ev.goal { color: var(--green); font-weight: 700; }
.ev.meta { color: var(--text-3); }
.em { width: 34px; flex: 0 0 34px; font-variant-numeric: tabular-nums; color: var(--text-2); }
.ctrl { display: flex; gap: 8px; padding: 10px 12px; }
.ctrl .btn { flex: 1; }
</style>
