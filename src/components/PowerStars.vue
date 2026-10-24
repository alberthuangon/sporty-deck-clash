<template>
  <span class="ps">
    <span class="stars">
      <i v-for="n in 5" :key="n" :class="cls(n)">★</i>
    </span>
    <b v-if="showScore">{{ score }}</b>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { powerStars, powerScore } from '../engine/model.js'
const props = defineProps({ q: Number, showScore: { type: Boolean, default: true } })
const stars = computed(() => powerStars(props.q))
const score = computed(() => powerScore(props.q))
function cls (n) {
  if (stars.value >= n) return 'on'
  if (stars.value >= n - 0.5) return 'half'
  return 'off'
}
</script>

<style scoped>
.ps { display: inline-flex; align-items: center; gap: 6px; }
.stars { letter-spacing: 1px; font-size: 13px; line-height: 1; }
.stars i { font-style: normal; color: #4A4F5B; }
.stars i.on { color: #E0AC2B; }
.stars i.half { background: linear-gradient(90deg,#E0AC2B 50%,#4A4F5B 50%); -webkit-background-clip: text; background-clip: text; color: transparent; }
b { font-size: 14px; font-variant-numeric: tabular-nums; }
</style>
