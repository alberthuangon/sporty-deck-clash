<template>
  <div class="de" :class="{ picking }">
    <div class="de-content" :inert="!!picking">
      <header class="intro">
        <h1>BUILD YOUR STARTING FOUR</h1>
        <p>Your squad. Your advantage.</p>
        <div class="squad-tools">
          <div class="power" aria-live="polite"><span class="power-icon" aria-hidden="true">ϟ</span><span class="power-value"><small>SQUAD POWER</small><strong>{{ score }}</strong></span></div>
          <button class="optimize" title="Arrange your selected players for max power" @click="autoPlace"><span class="opt-icon" aria-hidden="true">⇄</span><span><strong>Optimize positions</strong><small>Maximize squad power</small></span></button>
        </div>
      </header>

      <section class="formation" aria-label="Starting lineup">

        <button v-for="s in SLOTS" :key="s.key" class="slot" :class="'slot-' + s.key" :aria-label="`Change ${s.label}: ${cardOf(draft[s.key]).name}`" @click="openPicker(s.key, $event)">
          <span class="slot-lbl">{{ s.code }}</span>
          <CardFace :card="cardOf(draft[s.key])" size="sm" full><span class="swap" aria-hidden="true">↻</span></CardFace>
        </button>
      </section>
      <p class="hint">Tap a player to change your lineup</p>

      <p class="feedback" role="status">{{ feedback }}</p>
    </div>
    <footer class="actions" :inert="!!picking">
      <button class="btn cancel" @click="go('home')">Cancel</button>
      <button class="btn btn-cta" @click="save">Save squad</button>
    </footer>

    <div v-if="picking" class="picker-backdrop sheet" @click.self="closePicker" @keydown.esc.stop="closePicker" @keydown.tab="trapFocus">
      <section ref="picker" class="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title" tabindex="-1">
        <header class="picker-head"><div><small>YOUR COLLECTION</small><h2 id="picker-title">Choose {{ SLOTS.find(s => s.key === picking).label }}</h2></div><button class="close" aria-label="Close player selection" @click="closePicker">×</button></header>
        <p class="picker-hint">Select a player. Players already in your lineup will swap positions.</p>
        <div class="pick-grid">
          <button v-for="id in options" :key="id" class="pick-option" :aria-label="`Select ${cardOf(id).name}${draft[picking] === id ? ', current player' : usedElsewhere(id) ? ', swap positions' : ''}`" :aria-pressed="draft[picking] === id" @click="choose(id)">
            <CardFace :card="cardOf(id)" size="sm" full :selected="draft[picking] === id" />
            <span class="pick-status">{{ draft[picking] === id ? 'Selected' : usedElsewhere(id) ? 'Swap' : 'Select' }}</span>
          </button>
        </div>
        <p v-if="!options.length" class="locked-note">No cards for this position yet.</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import CardFace from '../components/CardFace.vue'
import { powerScore } from '../engine/model.js'
import { store, go, cardOf, ownedIds, BY_ID, deckPower, bestPlacement } from '../game.js'

const SLOTS = [
  { key: 'gk', label: 'Goalkeeper', code: 'GK' },
  { key: 'df', label: 'Defender', code: 'DF' },
  { key: 'mf', label: 'Midfielder', code: 'MF' },
  { key: 'fw', label: 'Forward', code: 'FW' }
]
const draft = ref({ ...store.deck })
const picking = ref(null), picker = ref(null), feedback = ref('')
let pickerTrigger
const score = computed(() => powerScore(deckPower(draft.value)))
const options = computed(() => {
  if (!picking.value) return []
  const wantGk = picking.value === 'gk'
  return ownedIds().filter(id => (BY_ID[id].class === 'gk') === wantGk)
})
async function openPicker (key, event) {
  pickerTrigger = event.currentTarget
  picking.value = key
  await nextTick()
  picker.value?.focus({ preventScroll: true })
}
async function closePicker () {
  picking.value = null
  await nextTick()
  pickerTrigger?.focus({ preventScroll: true })
}
function trapFocus (event) {
  const buttons = [...picker.value.querySelectorAll('button')]
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === picker.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function usedElsewhere (id) {
  return Object.entries(draft.value).some(([k, v]) => k !== picking.value && v === id)
}
function choose (id) {
  const slot = picking.value
  const clash = Object.entries(draft.value).find(([k, v]) => k !== slot && v === id)
  const d = { ...draft.value }
  if (clash) d[clash[0]] = d[slot]
  d[slot] = id
  draft.value = d
  feedback.value = 'Lineup updated. Save when you’re ready.'
  closePicker()
}
function autoPlace () {
  const best = bestPlacement(draft.value.gk, [draft.value.fw, draft.value.mf, draft.value.df])
  if (best) draft.value = best.deck
  feedback.value = 'Your selected players are in their strongest positions.'
}
function save () { store.deck = { ...draft.value }; go('home') }
</script>

<style scoped>
.de { position:relative; min-height:0; overflow:hidden; background:#08131e url('../assets/squad-art/stadium.webp') center / cover no-repeat; }
.de::before { content:''; position:absolute; inset:0; pointer-events:none; background:linear-gradient(#04111fce 0%,#04111f44 24%,#04111f10 60%,#04111fb3 100%); }
.de.picking .de-content, .de.picking .actions { visibility:hidden; }
.de-content { position:relative; flex:1; min-height:0; overflow:hidden; display:grid; grid-template-rows:auto minmax(0,1fr) auto 16px; gap:6px; padding:14px 16px 6px; }
.intro { text-align:center; }
h1 { font-size:19px; line-height:1.2; letter-spacing:.015em; margin:0; }
.intro p { color:#c3d5e2; font-size:13px; margin:5px 0 10px; text-shadow:0 2px 8px #000; }
.squad-tools { display:grid; grid-template-columns:1fr 1fr; gap:10px; max-width:380px; margin:0 auto; }
.power { display:flex; justify-content:center; align-items:center; gap:10px; padding:7px 12px; border:1px solid #7195ab66; border-radius:12px; background:#081826df; box-shadow:0 5px 20px #0004; }
.power-icon { color:#65e7ed; font-size:28px; line-height:1; }
.power-value { display:flex; flex-direction:column; text-align:left; gap:1px; }.power-value small { font-size:9px; font-weight:700; letter-spacing:.07em; }
.power strong { font-size:25px; font-variant-numeric:tabular-nums; }
.formation { position:relative; min-height:0; width:100%; margin-bottom:60px; container-type:size; }
.slot { position:absolute; display:flex; flex-direction:column; align-items:center; min-width:0; width:min(28cqw,calc((100cqh - 76px) / 4.2),114px); color:white; padding:0; border:0; background:none; cursor:pointer; filter:drop-shadow(0 8px 10px #0009); }
.slot-gk { bottom:0; left:50%; transform:translateX(-50%); }.slot-df { top:50%; left:4%; transform:translateY(-50%); }.slot-mf { top:50%; right:4%; transform:translateY(-50%); }.slot-fw { top:0; left:50%; transform:translateX(-50%); }
.slot-lbl { display:block; border:1px solid #89bbac; border-radius:20px; padding:3px 13px; min-width:44px; font-size:10px; line-height:12px; font-weight:800; margin-bottom:4px; background:#102d28; box-shadow:0 2px 8px #0008; }
.slot :deep(.cf) { width:100%; }
.swap { position:absolute; right:4px; bottom:28px; width:22px; height:22px; border:1px solid #c1dfec; border-radius:50%; background:#071421e8; display:grid; place-items:center; font-size:20px; color:#d5edf7; z-index:7; line-height:1; }
.hint { text-align:center; color:#d5e5ec; font-size:11px; margin:2px 0; text-shadow:0 2px 6px #000; }
.optimize { min-height:56px; display:flex; align-items:center; justify-content:center; width:100%; gap:8px; padding:8px; color:#f0f7fc; background:linear-gradient(120deg,#173a35f5,#0d2525f5); border:1px solid #64d7ac80; border-radius:12px; text-align:left; cursor:pointer; }
.opt-icon { font-size:29px; color:#67efa8; line-height:1; }.optimize > span:nth-child(2) { min-width:0; }.optimize strong { display:block; font-size:12px; }.optimize small { display:block; font-size:9px; line-height:1.4; color:#b5d9c9; margin-top:3px; }
.feedback { font-size:10px; line-height:16px; height:16px; color:#9bf6c5; margin:0; text-align:center; white-space:nowrap; }
.actions { position:relative; display:grid; grid-template-columns:1fr 1.25fr; gap:10px; padding:12px 16px max(12px,env(safe-area-inset-bottom)); border-top:1px solid #334a5c; background:#0e1b27f5; flex:none; }
.cancel { background:#192b38; border:1px solid #4b6173; }.actions .btn { min-height:46px; }
.picker-backdrop { position:absolute; inset:0; display:flex; align-items:flex-end; background:#020a13ba; z-index:100; backdrop-filter:blur(5px); }
.picker { width:100%; max-height:90%; overflow:auto; overscroll-behavior:contain; background:linear-gradient(130deg,#223644,#101d2a); padding:18px 14px; border:1px solid #536d7e; border-radius:18px 18px 0 0; outline:none; box-shadow:0 -12px 50px #0008; }
.picker-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }.picker-head small { font-size:9px; color:#7fe9b3; letter-spacing:.12em; font-weight:700; }.picker h2 { font-size:19px; margin:5px 0 0; }.close { width:44px; height:44px; border-radius:50%; background:#344b5d; color:#e9f8ff; font-size:26px; cursor:pointer; flex:none; }.picker-hint { font-size:11px; color:#bacdda; line-height:1.5; margin:12px 0; }
.pick-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 8px; }.pick-option { padding:0; color:white; background:none; min-width:0; cursor:pointer; }.pick-option :deep(.cf) { width:100%; }.pick-status { display:block; font-size:11px; padding:8px 0; color:#c5dce6; }.pick-option[aria-pressed=true] .pick-status { color:#6ceca8; font-weight:700; }
button:focus-visible { outline:2px solid #6cf0bf; outline-offset:3px; }
@media(max-width:370px) { .de-content { padding:10px 12px 4px; gap:5px; } h1 { font-size:16px; }.intro p { font-size:11px; margin-bottom:7px; }.swap { width:20px; height:20px; font-size:18px; }.squad-tools { gap:7px; }.optimize { padding:7px; gap:6px; }.optimize strong { font-size:11px; }.optimize small { font-size:9px; }.actions { padding-left:12px; padding-right:12px; }.feedback { font-size:9px; } }
@media(max-height:650px) { .intro p { display:none; } h1 { font-size:14px; margin-bottom:6px; }.power { padding:4px 12px; }.power strong { font-size:21px; }.slot { width:min(28cqw,calc((100cqh - 50px) / 2.8),100px); }.slot-fw { top:0; left:28%; }.slot-mf { top:0; right:8%; transform:none; }.slot-df { top:auto; bottom:0; left:8%; transform:none; }.slot-gk { left:72%; }.actions { padding-top:8px; padding-bottom:8px; }.formation { margin-bottom:24px; }.optimize { min-height:46px; padding-top:6px; padding-bottom:6px; }.optimize small { display:none; } }
</style>
