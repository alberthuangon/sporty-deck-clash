<template>
  <span class="duel-crest" aria-hidden="true">
    <img :src="crestArt" width="384" height="480" alt="" decoding="async" draggable="false" />
    <b>{{ label }}</b>
  </span>
</template>
<script setup>
import crestArt from '../assets/matchmaking-art/crest.webp'
defineProps({ label: { type: String, default: '?' } })
</script>
<style scoped>
.duel-crest { position: relative; display: block; width: 124px; aspect-ratio: 4 / 5; flex: none; filter: drop-shadow(0 8px 12px #0008); }
img { display: block; width: 100%; height: 100%; object-fit: contain; }
b { position: absolute; inset: 27% 8% 25%; display: flex; align-items: center; justify-content: center; font-size: 48px; line-height: 1; font-weight: 900; letter-spacing: -.07em; color: #e1e7ef; background: linear-gradient(145deg,#fff 12%,#dce4ed 43%,#8e9caa 66%,#f3f6fa 90%); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 1px #0009); }
</style>
