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
import { ODDS_CAP } from '../engine/model.js'
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
      if (found.candidates.length) push('Rejected over odds cap', found.candidates.length)
      push('Closest Power: ' + found.opponent.handle, powerScore(found.opponent.power))
    } },
    { d: 2100, fn: () => { statusText.value = 'Stage 2 — verifying odds'; push('Your odds', found.priced.oddsA.toFixed(2)) } },
    { d: 2500, fn: () => { push('Their odds', found.priced.oddsB.toFixed(2)) } },
    { d: 2900, fn: () => {
      push('Both ≤ ' + ODDS_CAP.toFixed(2) + ' — match accepted', '✓', 'ok')
      statusText.value = 'Opponent found'
      ready.value = true
    } }
  ]
  timers = steps.map(s => setTimeout(s.fn, s.d))
})
onUnmounted(() => timers.forEach(clearTimeout))

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
.lrow { display: flex; justify-content: space-between; font-size: 12px; padding: 7px 0; border-bottom: 1px solid var(--divider); }
.lrow:last-child { border-bottom: 0; }
.lrow.ok { color: var(--green); font-weight: 700; }
.lv { font-variant-numeric: tabular-nums; font-weight: 700; }
.mm > .btn { width: 100%; }
</style>
