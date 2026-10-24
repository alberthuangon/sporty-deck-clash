<template>
  <div class="scroll pad">
    <div class="card pad" style="margin-bottom:12px">
      <h2 class="sec-title" style="margin-bottom:6px">Scaffold check</h2>
      <div class="muted" style="font-size:12px;line-height:1.5">
        Shell is live: red top bar, wallet chips, 5-tab bar, screen switching,
        GSAP screen transition, tokens as CSS variables, localStorage-backed store.
        Tap the title 5&times; for demo settings.
      </div>
    </div>

    <h2 class="sec-title">Stack screens (temporary nav)</h2>
    <div class="grid">
      <button v-for="s in stack" :key="s" class="btn" @click="go(s)">{{ s }}</button>
    </div>

    <h2 class="sec-title" style="margin-top:18px">Token swatches</h2>
    <div class="sw-row">
      <div v-for="s in swatches" :key="s.v" class="sw">
        <i :style="{ background: s.v }"></i><span>{{ s.n }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { go } from '../store.js'
const stack = ['packopen', 'upgrade', 'deckedit', 'tierselect', 'matchmaking', 'confirm', 'toss', 'match', 'result']
const swatches = [
  { n: 'bg', v: '#1B1E25' }, { n: 'surface', v: '#2C3039' }, { n: 'surface-hi', v: '#353A45' },
  { n: 'red', v: '#E41827' }, { n: 'green', v: '#32CE62' }, { n: 'cta', v: '#33EA6A' },
  { n: 'cta-deep', v: '#0D9737' }, { n: 'text-2', v: '#9CA0AB' }
]
</script>

<style scoped>
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.grid .btn { height: 38px; font-size: 13px; font-weight: 600; }
.sw-row { display: flex; flex-wrap: wrap; gap: 8px; }
.sw { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: var(--text-2); width: 60px; }
.sw i { width: 46px; height: 28px; border-radius: 4px; border: 1px solid rgba(255,255,255,.1); }
</style>
