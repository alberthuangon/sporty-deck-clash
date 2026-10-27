<template>
  <div class="scroll pad mm">
    <div class="radar-anim"><div class="sweep"></div><div class="blip">{{ myScore }}</div></div>
    <div class="status">{{ statusText }}</div>

    <div class="log">
      <div v-for="(l,i) in log" :key="i" class="lrow" :class="l.kind">
        <span>{{ l.text }}</span>
        <span class="lv">{{ l.value }}</span>
      </div>
    </div>

    <button v-if="ready" class="btn btn-cta" @click="go('confirm')">Continue</button>
    <button v-else class="btn" @click="cancel">Cancel search</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { store, go, startMatchmaking, deckPower, powerScore, abandonMatch } from '../game.js'
import { ODDS_CAP, MARGIN } from '../engine/model.js'

/* the 2.50 odds cap expressed as what it actually constrains: how lopsided a
   pairing is allowed to be */
const LOW = (1 - MARGIN) / ODDS_CAP
const BAND = (LOW * 100).toFixed(0) + '–' + ((1 - LOW) * 100).toFixed(0) + '%'
import { opponentPool } from '../engine/opponents.js'

const log = ref([])
const ready = ref(false)
const statusText = ref('Locking your squad…')
const myScore = computed(() => powerScore(deckPower()))
let timers = []

onMounted(() => {
  const fee = store.pendingTier || 50
  const found = startMatchmaking(fee)
  if (!found) { statusText.value = 'No opponent available'; return }

  const steps = [
    { d: 400, fn: () => { statusText.value = 'Searching the ₦' + fee + ' queue…'; push('Your Power (q_ref)', myScore.value) } },
    { d: 900, fn: () => { statusText.value = 'Stage 1 — closest Power'; push('Candidates in queue', opponentPool().length) } },
    { d: 1500, fn: () => {
      if (found.candidates.length) push('Too far apart, skipped', found.candidates.length)
      push('Closest Power: ' + found.opponent.handle, powerScore(found.opponent.power))
    } },
    /* Stage 2 checks whether the two squads are close enough to pair, so it
       reads out win chance, not price. Odds are a quote and belong on the
       confirm screen, where they are one. */
    { d: 2100, fn: () => {
      statusText.value = 'Stage 2 — checking the match is fair'
      push('Win chance — you', pct(found.priced.qA))
    } },
    { d: 2500, fn: () => { push('Win chance — ' + found.opponent.handle, pct(found.priced.qB)) } },
    { d: 2900, fn: () => {
      push('Both inside ' + BAND + ' — accepted', '✓', 'ok')
      statusText.value = 'Opponent found'
      ready.value = true
    } }
  ]
  timers = steps.map(s => setTimeout(s.fn, s.d))
})
onUnmounted(() => timers.forEach(clearTimeout))

function pct (q) { return (q * 100).toFixed(1) + '%' }
function push (text, value, kind = '') { log.value.push({ text, value, kind }) }
function cancel () { abandonMatch(); go('tierselect') }
</script>

<style scoped>
.mm { display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 24px; }
.radar-anim {
  position: relative; width: 150px; height: 150px; border-radius: 50%;
  border: 1px solid var(--divider);
  background:
    radial-gradient(circle, transparent 0 32%, rgba(255,255,255,.05) 32% 33%, transparent 33%),
    radial-gradient(circle, transparent 0 64%, rgba(255,255,255,.05) 64% 65%, transparent 65%);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.sweep {
  position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(from 0deg, rgba(50,206,98,.35), transparent 28%);
  animation: spin 1.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.blip { position: relative; font-size: 20px; font-weight: 800; }
.status { font-size: 14px; font-weight: 700; }
.log { width: 100%; background: var(--surface); border-radius: var(--r-md); padding: 4px 12px; min-height: 120px; }
/* the log streams in a row at a time and ends up taller than its min-height,
   so a button sitting under it walks down the screen while the player is
   reaching for it. Pinned to the bottom instead: the log grows into the gap */
.lrow { display: flex; justify-content: space-between; font-size: 12px; padding: 7px 0; border-bottom: 1px solid var(--divider); }
.lrow:last-child { border-bottom: 0; }
.lrow.ok { color: var(--green); font-weight: 700; }
.lv { font-variant-numeric: tabular-nums; font-weight: 700; }
.mm > .btn { width: 100%; margin-top: auto; }
</style>
