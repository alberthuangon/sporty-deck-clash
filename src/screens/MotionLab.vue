<template>
  <div class="scroll lab">
    <Stage
      ref="stageRef"
      :home="home" :away="away"
      home-name="Home XI" away-name="Away XI"
      :home-is-me="side === 'home'"
    />

    <div class="pad ctrl">
      <div class="row">
        <button class="btn btn-cta play" :disabled="running" @click="play">
          {{ running ? 'Playing…' : (mode === 'pk' ? 'Play PK' : 'Play wave') }}
        </button>
        <button class="btn stop" @click="stop">Reset</button>
      </div>

      <div class="seg">
        <span class="lbl">What to play</span>
        <div class="opts">
          <button :class="{ on: mode === 'wave' }" @click="mode = 'wave'">Attack wave</button>
          <button :class="{ on: mode === 'pk' }" @click="mode = 'pk'">PK decider</button>
        </div>
      </div>

      <div class="seg" v-if="mode === 'pk'">
        <span class="lbl">Story</span>
        <div class="opts wrap">
          <button v-for="st in PK_STORIES" :key="st.id" :class="{ on: story === st.id }" @click="story = st.id">
            {{ st.label }}
          </button>
        </div>
      </div>

      <div class="seg" v-if="mode === 'wave'">
        <span class="lbl">Attacking side</span>
        <div class="opts">
          <button v-for="s in ['home','away']" :key="s" :class="{ on: side === s }" @click="side = s">
            {{ s }}
          </button>
        </div>
      </div>

      <div class="seg" v-if="mode === 'wave'">
        <span class="lbl">Outcome</span>
        <div class="opts wrap">
          <button v-for="o in OUTCOMES" :key="o.id" :class="{ on: outcome === o.id }" @click="outcome = o.id">
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="seg" v-if="mode === 'wave'">
        <span class="lbl">Finisher</span>
        <div class="opts">
          <button v-for="s in ['df','mf','fw']" :key="s" :class="{ on: actor === s }" @click="actor = s">
            {{ s.toUpperCase() }}
          </button>
        </div>
      </div>

      <div class="seg">
        <span class="lbl">Playback {{ speed.toFixed(2) }}×</span>
        <input type="range" min="0.25" max="2" step="0.05" v-model.number="speed" />
      </div>

      <div class="sec-title" style="margin-top:14px">Beat lengths (seconds)</div>
      <div v-for="k in BEAT_KEYS" :key="k" class="beat">
        <span class="bk">{{ k }}</span>
        <input type="range" :min="k === 'idle' || k === 'press' ? 0 : (k === 'slowmo' ? 0.15 : 0.05)"
               :max="range(k)" step="0.01" v-model.number="beat[k]" @input="k === 'idle' && restartIdle()" />
        <span class="bv">{{ beat[k].toFixed(2) }}</span>
      </div>

      <div class="readout">
        <div><span class="muted">{{ mode === 'pk' ? 'Decider' : 'Wave' }} duration</span><b>{{ waveLen.toFixed(2) }}s</b></div>
        <div><span class="muted">Shootout (3 rounds)</span><b>{{ pkDuration(6, beat).toFixed(2) }}s</b></div>
        <div><span class="muted">Timeline length</span><b>{{ lastLen.toFixed(2) }}s</b></div>
        <div class="budget" :class="budgetClass">
          <span class="muted">Projected match</span>
          <b>{{ projected.toFixed(0) }}s</b>
          <span class="muted">cap 30s</span>
        </div>
      </div>

      <div class="sfxlog">
        <div class="sec-title" style="margin-bottom:6px">data-sfx hooks fired</div>
        <div v-if="!sfxLog.length" class="muted" style="font-size:11px">— play a wave —</div>
        <span v-for="(s,i) in sfxLog" :key="i" class="tag">{{ s }}</span>
      </div>

      <div class="btn-row" style="margin-top:14px">
        <button class="btn" @click="resetBeats">Reset beats</button>
        <button class="btn" @click="go('settings')">Back</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'
import Stage from '../match/Stage.vue'
import { go, BY_ID } from '../game.js'
import { buildTeam } from '../engine/model.js'
import { buildWave, buildGoalCutIn, buildSaveCutIn, buildPkShowdown, resetStage, startIdle, stopIdle, idleTimeline } from '../match/player.js'
import { BEAT, waveDuration, matchDuration, pkDuration } from '../match/stageModel.js'

const OUTCOMES = [
  { id: 'GOAL', label: 'Goal' },
  { id: 'SHOT_SAVE', label: 'Saved' },
  { id: 'SHOT_POST', label: 'Post' },
  { id: 'SHOT_OFF', label: 'Wide' },
  { id: 'TACKLED', label: 'Tackled' }
]
const BEAT_KEYS = ['buildUp', 'pass', 'carry', 'shot', 'goalHang', 'slowmo', 'cutIn', 'saveCutIn',
  'rebound', 'reset', 'gap', 'clockRun', 'pkKick', 'pkShowdown', 'pkStrike', 'pkReveal', 'idle', 'press']

const home = buildTeam({
  gk: { def: BY_ID.G2, level: 3 }, fw: { def: BY_ID.F12, level: 4 },
  mf: { def: BY_ID.F8, level: 3 }, df: { def: BY_ID.F9, level: 3 }
}, 'Home XI')
const away = buildTeam({
  gk: { def: BY_ID.G3, level: 3 }, fw: { def: BY_ID.F7, level: 4 },
  mf: { def: BY_ID.F11, level: 3 }, df: { def: BY_ID.F13, level: 3 }
}, 'Away XI')

const PK_STORIES = [
  { id: 'wrongWay', label: 'Keeper goes the wrong way', outcome: 'GOAL', direction: 'RIGHT', height: 'LOW', dive: 'LEFT' },
  { id: 'soClose', label: 'Right way, still in', outcome: 'GOAL', direction: 'LEFT', height: 'HIGH', dive: 'LEFT' },
  { id: 'saved', label: 'Saved', outcome: 'SAVED', direction: 'RIGHT', height: 'LOW', dive: 'RIGHT' },
  { id: 'post', label: 'Off the post', outcome: 'POST', direction: 'LEFT', height: 'HIGH', dive: 'RIGHT' },
  { id: 'missed', label: 'Ballooned over', outcome: 'MISS', direction: 'CENTRE', height: 'HIGH', dive: 'RIGHT' }
]

const stageRef = ref(null)
const mode = ref('wave')
const story = ref('wrongWay')
const side = ref('home')
const outcome = ref('GOAL')
const actor = ref('fw')
const speed = ref(1)
const running = ref(false)
const lastLen = ref(0)
const sfxLog = ref([])
const beat = reactive({ ...BEAT })

let tl = null

const waveLen = computed(() =>
  mode.value === 'pk' ? (beat.pkShowdown + beat.pkStrike + beat.pkReveal) : waveDuration(outcome.value, beat))
/* a representative match that goes to penalties: 1-1, a few wasted attacks and
   a 3-round shootout. Albert's cap is 30s for the WHOLE thing. */
const projected = computed(() => matchDuration({ goals: 2, saves: 2, misses: 3, pkKicks: 6 }, beat))
const budgetClass = computed(() => (projected.value <= 30 ? 'ok' : 'high'))

function stageApi () { return stageRef.value && stageRef.value.api }

function onSfx (label) { sfxLog.value.push(label) }

function restartIdle () {
  const api = stageApi()
  if (api) startIdle(api, beat.idle)
}

function stop () {
  if (tl) { tl.kill(); tl = null }
  running.value = false
  const api = stageApi()
  if (api) { stopIdle(); resetStage(api); api.reset(); startIdle(api, beat.idle) }
  sfxLog.value = []
}

async function play (opts = {}) {
  stop()
  await nextTick()
  const api = stageApi()
  if (!api) return
  running.value = true

  const master = gsap.timeline({
    onComplete: () => { running.value = false; lastLen.value = master.duration() }
  })
  const onRate = (rate) => {
    if (opts.paused) return          // recorder drives the clock itself
    gsap.to(master, { timeScale: rate * speed.value, duration: .12, ease: 'power2.out' })
  }

  if (mode.value === 'pk') {
    const st = PK_STORIES.find(x => x.id === story.value)
    master.add(buildPkShowdown(api, {
      shooter: api.card('home', 'fw'),
      keeper: api.card('away', 'gk'),
      outcome: st.outcome, direction: st.direction, height: st.height, dive: st.dive,
      label: 'ROUND 4 · SUDDEN DEATH',
      board: { HOME: ['goal', 'goal', 'miss'], AWAY: ['goal', 'miss', 'goal'] },
      boardAfter: { HOME: ['goal', 'goal', 'miss', st.outcome === 'GOAL' ? 'goal' : 'miss'], AWAY: ['goal', 'miss', 'goal'] }
    }, beat, onSfx, onRate))
    master.timeScale(speed.value)
    lastLen.value = master.duration()
    tl = master
    if (opts.paused) { master.pause(0); running.value = false }
    return master.duration()
  }

  master.add(buildWave(api, {
    side: side.value, actorSlot: actor.value, outcome: outcome.value, variance: Math.random()
  }, beat, onSfx, onRate))

  if (outcome.value === 'GOAL') {
    const card = api.card(side.value, actor.value)
    const h = side.value === 'home' ? 1 : 0
    const a = side.value === 'away' ? 1 : 0
    master.add(buildGoalCutIn(api, {
      card, scoreSide: side.value, scoreHome: h, scoreAway: a,
      subtitle: `${card.name} · ${side.value === 'home' ? 'Home XI' : 'Away XI'}`
    }, beat, onSfx), `-=${beat.reset + beat.gap}`)
  } else if (outcome.value === 'SHOT_SAVE') {
    const keeper = api.card(side.value === 'home' ? 'away' : 'home', 'gk')
    master.add(buildSaveCutIn(api, { card: keeper }, beat, onSfx), `-=${beat.reset + beat.gap}`)
  }

  master.timeScale(speed.value)
  lastLen.value = master.duration()
  tl = master
  if (opts.paused) { master.pause(0); running.value = false }
  return master.duration()
}

/* timeline window during which a goal runs in slow motion */
function slowmoWindow () {
  const start = beat.buildUp + beat.pass * 2 + beat.carry
  return { start, end: start + beat.shot + beat.goalHang, rate: beat.slowmo }
}

/* Dev hook: lets a frame-exact recorder drive the timeline from outside.
   Stripped from production builds. */
if (import.meta.env.DEV) {
  window.__lab = {
    arm: async (o = {}) => {
      if (o.side) side.value = o.side
      if (o.outcome) outcome.value = o.outcome
      if (o.actor) actor.value = o.actor
      await nextTick()
      const d = await play({ paused: true })
      const idle = idleTimeline()
      if (idle) idle.pause(0)
      return { duration: d, slowmo: o.outcome === 'GOAL' ? slowmoWindow() : null }
    },
    seek: (p) => {
      const q = Math.max(0, Math.min(1, p))
      if (tl) tl.progress(q)
      const idle = idleTimeline()
      if (idle) { idle.pause(); idle.time(q * (tl ? tl.duration() : 0)) }
    },
    reset: () => stop()
  }
}

defineExpose({})
function range (k) {
  if (k === 'slowmo' || k === 'press') return 1
  if (k === 'idle') return 8
  if (k === 'pkShowdown' || k === 'pkStrike') return 2.5
  if (k === 'cutIn') return 3.5
  if (k === 'clockRun') return 6
  return 1.6
}
function resetBeats () { Object.assign(beat, BEAT) }

onMounted(() => {
  nextTick(() => { const a = stageApi(); if (a) { resetStage(a); startIdle(a, beat.idle) } })
})
onUnmounted(() => { if (tl) tl.kill(); stopIdle() })
</script>

<style scoped>
.lab { padding-bottom: 20px; }
.ctrl { display: flex; flex-direction: column; gap: 10px; }
.row { display: flex; gap: 8px; }
.play { flex: 2; } .stop { flex: 1; }
.seg { display: flex; align-items: center; gap: 10px; }
.lbl { font-size: 11px; color: var(--text-2); width: 112px; flex: 0 0 112px; }
.opts { display: flex; gap: 5px; flex: 1; }
.opts.wrap { flex-wrap: wrap; }
.opts button {
  background: var(--surface-hi); border-radius: var(--r-sm);
  padding: 5px 9px; font-size: 11px; font-weight: 700; color: var(--text-2);
}
.opts button.on { background: var(--cta); color: #06240F; }
.seg input[type=range] { flex: 1; accent-color: var(--cta); }
.beat { display: flex; align-items: center; gap: 8px; }
.bk { font-size: 10px; color: var(--text-2); width: 66px; flex: 0 0 66px; }
.beat input { flex: 1; accent-color: var(--green); }
.bv { font-size: 11px; width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
.readout { background: var(--surface); border-radius: var(--r-md); padding: 10px 12px; font-size: 12px; }
.readout > div { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; gap: 8px; }
.readout b { font-variant-numeric: tabular-nums; }
.budget { border-top: 1px solid var(--divider); margin-top: 4px; padding-top: 6px !important; }
.budget.ok b { color: var(--cta); }
.budget.low b, .budget.high b { color: var(--r-l); }
.sfxlog { background: var(--surface-lo); border-radius: var(--r-md); padding: 10px 12px; }
.tag { display: inline-block; background: var(--surface-hi); border-radius: 3px; padding: 2px 6px; font-size: 10px; margin: 0 4px 4px 0; color: var(--text-2); }
</style>
