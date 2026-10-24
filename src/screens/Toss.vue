<template>
  <div class="scroll pad to">
    <div class="coin" :class="{ done: revealed }" data-sfx="toss">
      <span v-if="!revealed">?</span>
      <span v-else>{{ iAmHome ? 'H' : 'A' }}</span>
    </div>
    <div class="t-status">{{ revealed ? (iAmHome ? 'You are playing HOME' : 'You are playing AWAY') : 'Tossing…' }}</div>
    <div v-if="revealed" class="t-detail muted">
      {{ iAmHome
        ? 'Home advantage applies to your squad this match.'
        : 'Your opponent gets the home advantage this match.' }}
    </div>
    <div v-if="revealed" class="t-fine muted">
      Odds were already priced across both branches, so this is expectation-neutral.
      Stakes are now locked.
    </div>
    <button v-if="revealed" class="btn btn-cta" @click="go('match')">Kick off</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { go, runToss, matchView } from '../game.js'
const revealed = ref(false)
const iAmHome = ref(false)
let t
onMounted(() => {
  const res = runToss()
  iAmHome.value = res.aIsHome
  t = setTimeout(() => { revealed.value = true }, 1600)
})
onUnmounted(() => clearTimeout(t))
</script>

<style scoped>
.to { display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 70px; }
.coin {
  width: 120px; height: 120px; border-radius: 50%;
  background: linear-gradient(145deg, #4A5160, #262A33);
  border: 2px solid var(--divider);
  display: flex; align-items: center; justify-content: center;
  font-size: 44px; font-weight: 800;
  animation: flip .35s linear infinite;
}
.coin.done { animation: none; border-color: var(--green); color: var(--green); }
@keyframes flip { 50% { transform: scaleX(.08); } }
.t-status { font-size: 18px; font-weight: 800; }
.t-detail { font-size: 13px; text-align: center; }
.t-fine { font-size: 10px; text-align: center; line-height: 1.5; max-width: 280px; }
.to > .btn { width: 100%; margin-top: 6px; }
</style>
