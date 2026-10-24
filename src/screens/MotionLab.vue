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
          {{ running ? 'Playing…' : 'Play wave' }}
        </button>
        <button class="btn stop" @click="stop">Reset</button>
      </div>

      <div class="seg">
        <span class="lbl">Attacking side</span>
        <div class="opts">
          <button v-for="s in ['home','away']" :key="s" :class="{ on: side === s }" @click="side = s">
            {{ s }}
          </button>
        </div>
      </div>

      <div class="seg">
        <span class="lbl">Outcome</span>
        <div class="opts wrap">
          <button v-for="o in OUTCOMES" :key="o.id" :class="{ on: outcome === o.id }" @click="outcome = o.id">
            {{ o.label }}
          </button>
        </div>
      </div>

      <div class="seg">
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
        <input type="range" :min="k === 'slowmo' ? 0.15 : 0.05" :max="range(k)" step="0.01" v-model.number="beat[k]" />
        <span class="bv">{{ beat[k].toFixed(2) }}</span>
      </div>

      <div class="readout">
        <div><span class="muted">Wave duration</span><b>{{ waveLen.toFixed(2) }}s</b></div>
        <div><span class="muted">Timeline length</span><b>{{ lastLen.toFixed(2) }}s</b></div>
        <div class="budget" :class="budgetClass">
          <span class="muted">Projected match</span>
          <b>{{ projected.toFixed(0) }}s</b>
          <span class="muted">target 45–60s</span>
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
import { buildWave, buildGoalCutIn, buildSaveCutIn, resetStage } from '../match/player.js'
import { BEAT, waveDuration, matchDuration } from '../match/stageModel.js'

const OUTCOMES = [
  { id: 'GOAL', label: 'Goal' },
  { id: 'SHOT_SAVE', label: 'Saved' },
  { id: 'SHOT_POST', label: 'Post' },
  { id: 'SHOT_OFF', label: 'Wide' },
  { id: 'TACKLED', label: 'Tackled' }
]
const BEAT_KEYS = ['buildUp', 'pass', 'carry', 'shot', 'goalHang', 'slowmo', 'cutIn', 'saveCutIn', 'rebound', 'reset', 'gap', 'clockRun']

const home = buildTeam({
  gk: { def: BY_ID.G2, level: 3 }, fw: { def: BY_ID.F12, level: 4 },
  mf: { def: BY_ID.F8, level: 3 }, df: { def: BY_ID.F9, level: 3 }
}, 'Home XI')
const away = buildTeam({
  gk: { def: BY_ID.G3, level: 3 }, fw: { def: BY_ID.F7, level: 4 },
  mf: { def: BY_ID.F11, level: 3 }, df: { def: BY_ID.F13, level: 3 }
}, 'Away XI')

const stageRef = ref(null)
const side = ref('home')
const outcome = ref('GOAL')
const actor = ref('fw')
const speed = ref(1)
const running = ref(false)
const lastLen = ref(0)
const sfxLog = ref([])
const beat = reactive({ ...BEAT })

let tl = null

const waveLen = computed(() => waveDuration(outcome.value, beat))
/* a representative match: 2 goals, 2 saves, 4 misses, plus the clock running
   between every event. This is the number PRD §15.1 wants inside 45-60s. */
const projected = computed(() => matchDuration({ goals: 2, saves: 2, misses: 4 }, beat))
const budgetClass = computed(() =>
  projected.value >= 45 && projected.value <= 60 ? 'ok' : (projected.value < 45 ? 'low' : 'high'))

function stageApi () { return stageRef.value && stageRef.value.api }

function onSfx (label) { sfxLog.value.push(label) }

function stop () {
  if (tl) { tl.kill(); tl = null }
  running.value = false
  const api = stageApi()
  if (api) { resetStage(api); api.reset() }
  sfxLog.value = []
}

async function play () {
  stop()
  await nextTick()
  const api = stageApi()
  if (!api) return
  running.value = true

  const master = gsap.timeline({
    onComplete: () => { running.value = false; lastLen.value = master.duration() }
  })
  const onRate = (rate) => { gsap.to(master, { timeScale: rate * speed.value, duration: .12, ease: 'power2.out' }) }
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
}

function range (k) {
  if (k === 'slowmo') return 1
  if (k === 'cutIn') return 3.5
  if (k === 'clockRun') return 6
  return 1.6
}
function resetBeats () { Object.assign(beat, BEAT) }

onMounted(() => { nextTick(() => { const a = stageApi(); if (a) resetStage(a) }) })
onUnmounted(() => { if (tl) tl.kill() })
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
