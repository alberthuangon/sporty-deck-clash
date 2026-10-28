<template>
  <span class="rank-crest" :class="[{ 'crest-hero': hero }, 'crest-tier-' + tier]" aria-hidden="true">
    <img :src="crest" width="512" height="512" alt="" decoding="async">
    <span class="crest-number">{{ tier === 5 ? '★' : (SUBTIER_LABEL[sub] || '') }}</span>
  </span>
</template>
<script setup>
import crest from '../assets/rank-art/crest.webp'
import { SUBTIER_LABEL } from '../engine/economy.js'
defineProps({ tier: { type: Number, default: 0 }, sub: { type: Number, default: 3 }, hero: Boolean })
</script>
<style scoped>
.rank-crest { display: inline-block; position: relative; width: 36px; height: 40px; flex: none; color: #ffd6a1; filter: drop-shadow(0 2px 3px #0009); }
.rank-crest img { display: block; width: 100%; height: 100%; object-fit: contain; }
.crest-number { position: absolute; top: 48%; left: 0; right: 0; text-align: center; font: 700 14px/1 Georgia,serif; text-shadow: 0 1px 1px #351602, 0 -1px 0 #fff5; }
.crest-hero { width: 174px; height: 174px; margin-top: 5px; filter: drop-shadow(0 5px 15px #0009); }
.crest-hero .crest-number { font-size: 50px; top: 48%; }
.crest-tier-1 { filter: saturate(0) brightness(1.25) drop-shadow(0 2px 4px #0008); }
.crest-tier-2 { filter: hue-rotate(13deg) saturate(1.35) brightness(1.2) drop-shadow(0 2px 4px #0008); }
.crest-tier-3 { filter: hue-rotate(130deg) saturate(.65) brightness(1.25) drop-shadow(0 2px 4px #0008); }
.crest-tier-4 { filter: hue-rotate(180deg) saturate(.85) brightness(1.35) drop-shadow(0 2px 4px #0008); }
.crest-tier-5 { filter: hue-rotate(325deg) saturate(1.4) brightness(1.2) drop-shadow(0 2px 4px #0008); }
</style>
