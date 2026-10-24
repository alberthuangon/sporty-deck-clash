<template>
  <div class="scroll pad ts">
    <p class="muted intro">
      All arenas use the same model and the same 5% margin — only the stake changes.
    </p>
    <div v-for="t in TIERS" :key="t.id" class="table" :class="{ locked: !unlocked(t) }"
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
          <div class="t-lock">🔒</div>
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
.table {
  display: flex; justify-content: space-between; align-items: center;
  background: var(--surface); border: 1px solid var(--divider);
  border-radius: var(--r-md); padding: 14px; cursor: pointer;
}
.table.locked { opacity: .62; cursor: not-allowed; }
.t-fee { font-size: 22px; font-weight: 800; }
.t-name { font-size: 12px; }
.t-r { text-align: right; }
.t-stake { font-size: 11px; }
.t-go { font-weight: 700; font-size: 14px; margin-top: 4px; }
.t-lock { font-size: 16px; }
.t-lockt { font-size: 11px; }
.t-need { font-size: 10px; margin-top: 2px; }
</style>
