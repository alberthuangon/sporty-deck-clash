<template>
  <div class="scroll pad">
    <div class="hdr">
      <h2 class="sec-title" style="margin:0">Daily Missions</h2>
      <span class="muted" style="font-size:11px">Resets in 6h 12m</span>
    </div>
    <p class="intro muted">
      Diamonds come from playing on SportyBet. Complete missions, spend the
      diamonds on card packs.
    </p>

    <div v-for="t in store.tasks" :key="t.id" class="mission" :class="{ ready: t.done && !t.claimed }">
      <div class="m-top">
        <span class="pill">{{ t.period }}</span>
        <span class="m-dl muted">Ends 23:59</span>
      </div>
      <div class="m-title">{{ t.title }}</div>
      <div class="m-reward">
        <div class="rw"><i class="gem">◆</i> {{ t.reward }}</div>
        <div v-if="!t.done" class="m-prog muted">{{ t.progress || 'In progress' }}</div>
      </div>
      <button v-if="t.done && !t.claimed" class="btn btn-cta claim" data-sfx="claim" @click="claim(t)">Claim</button>
      <button v-else-if="t.claimed" class="btn done" disabled>Claimed</button>
      <button v-else class="btn" disabled>Not complete</button>
    </div>

    <div v-if="justClaimed" class="toast">+{{ justClaimed }} ◆ added to your balance</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { store, claimTask } from '../game.js'
const justClaimed = ref(0)
function claim (t) {
  const n = claimTask(t.id)
  if (n) { justClaimed.value = n; setTimeout(() => { justClaimed.value = 0 }, 2200) }
}
</script>

<style scoped>
.hdr { display: flex; align-items: center; justify-content: space-between; }
.intro { font-size: 12px; margin: 0 0 12px; line-height: 1.45; }
.mission {
  background: var(--surface); border: 1px solid var(--divider);
  border-radius: var(--r-md); padding: 12px; margin-bottom: 10px;
}
.mission.ready { border-color: var(--cta-deep); }
.m-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.m-dl { font-size: 10px; }
.m-title { font-size: 14px; font-weight: 700; line-height: 1.3; margin-bottom: 10px; }
.m-reward { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.rw {
  background: var(--surface-hi); border-radius: var(--r-sm);
  padding: 6px 10px; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;
}
.gem { color: #6EE7FF; font-style: normal; }
.m-prog { font-size: 11px; }
.btn.done { background: transparent; border: 1px solid var(--divider); color: var(--text-2); }
.toast {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: 90px;
  background: var(--cta); color: #06240F; font-weight: 700;
  padding: 10px 16px; border-radius: 999px; font-size: 13px; z-index: 50;
}
</style>
