<template>
  <span class="match-crest" :class="tone" aria-hidden="true">
    <svg viewBox="0 0 64 72" fill="none"><path d="M32 3 59 13v23c0 16-15 27-27 33C20 63 5 52 5 36V13L32 3Z" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2"/><path d="m32 10 20 8v18c0 12-11 21-20 26-9-5-20-14-20-26V18l20-8Z" stroke="currentColor" stroke-opacity=".4"/></svg>
    <b>{{ label }}</b>
  </span>
</template>
<script setup>
import { GAME_MONOGRAM } from '../branding.js'
defineProps({ label: { type: String, default: GAME_MONOGRAM }, tone: { type: String, default: '' } })
</script>
<style scoped>
.match-crest {
  position:relative;
  display:inline-flex;
  width:58px;
  height:66px;
  align-items:center;
  justify-content:center;
  color:#c9d3df;
  flex:none;
  filter:drop-shadow(0 5px 12px #0008);
}
.match-crest svg {
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
}
.match-crest b {
  position:relative;
  font-size:19px;
  letter-spacing:-.04em;
}
.home {
  color:#ff8991;
}
.away {
  color:#86b9ff;
}
.gold {
  color:#eac878;
}
</style>
