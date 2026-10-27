<template>
  <div class="scroll pad ts">
    <p class="muted intro">
      All arenas use the same model and the same 5% margin — only the stake changes.
    </p>
    <div v-for="(t, i) in TIERS" :key="t.id" class="table" :class="[`tier-${i}`, { locked: !unlocked(t) }]"
         @click="pick(t)">
      <div class="t-l">
        <div class="t-fee">₦{{ t.fee }}</div>
        <div class="t-name muted">{{ t.name }}</div>
      </div>
      <div class="t-r">
        <template v-if="unlocked(t)">
          <div class="t-stake muted">Stake ₦{{ range(t).min }}–{{ range(t).max }}</div>
          <div class="t-go green">Enter ›</div>
        </template>
        <template v-else>
          <div class="t-lock"><Icon name="lock" /></div>
          <div class="t-lockt muted">Raise your Power to unlock</div>
          <div class="t-need muted">Need {{ score(t.unlockPower) }} · you have {{ score(colPower) }}</div>
        </template>
      </div>
    </div>
    <button class="btn" @click="go('home')">Back</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import { store, go, TIERS, collectionPower, stakeRange, powerScore } from '../game.js'
const colPower = computed(() => collectionPower())
function unlocked (t) { return colPower.value >= t.unlockPower }
function range (t) { return stakeRange(t.fee) }
function score (q) { return powerScore(q) }
function pick (t) {
  if (!unlocked(t)) return
  store.pendingTier = t.fee
  go('matchmaking')
}
</script>

<style scoped>
.ts { display: flex; flex-direction: column; gap: 10px; }
.intro { font-size: 12px; line-height: 1.45; margin: 0 0 4px; }
/* The three arenas differed only in their price, but they are a ladder of
   stakes and this product has already shown it can draw a ladder. Neutral ->
   playable -> high-value, all three already meanings in use, so no new colour
   family. Gold is the jackpot's colour and the Pro arena really is the rung
   nearest the jackpot, so the association is earned rather than borrowed.
   The bar is absolutely positioned and 3px, so it costs no layout; the
   information is still carried by the price itself. */
.table {
  position: relative; overflow: hidden;
  display: flex; justify-content: space-between; align-items: center;
  background: var(--surface); border: 1px solid var(--divider);
  border-radius: var(--r-md); padding: 14px; cursor: pointer;
}
.table::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--tier-accent, var(--divider));
}
.tier-0 { --tier-accent: var(--text-3); }
.tier-1 { --tier-accent: var(--green); }
.tier-2 { --tier-accent: var(--jackpot); }
/* Dimming the whole row dimmed the rung marker with it, so a locked arena
   stopped saying which arena it was. The contents recede; the bar goes
   neutral instead of fading — locked has to read as "not yours yet", never
   as "already open". */
.table.locked { opacity: 1; cursor: not-allowed; }
.table.locked .t-l, .table.locked .t-r { opacity: .55; }
.table.locked::before { background: var(--divider); }
.t-fee { font-size: 22px; font-weight: 800; color: var(--tier-accent); }
.t-name { font-size: 12px; }
.t-r { text-align: right; }
.t-stake { font-size: 11px; }
.t-go { font-weight: 700; font-size: 14px; margin-top: 4px; }
.t-lock { font-size: 16px; }
.t-lockt { font-size: 11px; }
.t-need { font-size: 10px; margin-top: 2px; }
</style>
