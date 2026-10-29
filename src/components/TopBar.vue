<template>
  <header class="topbar">
    <button class="tb-back" :class="{ hidden: !canBack }" @click="$emit('back')" aria-label="Back">
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="tb-title" :class="{ 'tb-brand': title === GAME_NAME }" :aria-label="title" @click="$emit('title')"><template v-if="title === GAME_NAME"><small>{{ GAME_BRAND.toUpperCase() }}</small><span>{{ GAME_TITLE.toUpperCase() }}</span></template><template v-else>{{ title }}</template></div>
    <div class="tb-wallet">
      <span class="w-item" data-wallet="cash">₦{{ cash.toLocaleString() }}</span>
      <span class="w-item" data-wallet="diamonds" role="group" :aria-label="`${diamonds.toLocaleString()} diamonds`"><DiamondIcon :size="14" />{{ diamonds.toLocaleString() }}</span>
    </div>
  </header>
</template>

<script setup>
import DiamondIcon from './DiamondIcon.vue'
import { GAME_NAME, GAME_BRAND, GAME_TITLE } from '../branding.js'
defineProps({ title: String, cash: Number, diamonds: Number, canBack: Boolean })
defineEmits(['back', 'title'])
</script>

<style scoped>
.topbar {
  height: var(--topbar-h);
  flex: 0 0 var(--topbar-h);
  background: var(--red);
  display: flex; align-items: center;
  padding: 0 8px; gap: 6px;
  position: relative; z-index: 20;
}
/* 44px of hit area, pulled back to the 30px it used to occupy so the title
   does not move. The icon inside stays 22px. */
.tb-back {
  width: 44px; height: 44px; margin: 0 -7px;
  display: flex; align-items: center; justify-content: center; color: #fff;
}
.tb-back.hidden { visibility: hidden; }
.tb-title { font-size: 15px; font-weight: 700; letter-spacing: .02em; white-space: nowrap; }
.tb-brand { display:flex; flex-direction:column; gap:1px; line-height:1.05; }.tb-brand small { font-size:8px; letter-spacing:.16em; font-weight:750; color:#ffe5e7; }.tb-brand > span { font-size:13px; font-weight:850; letter-spacing:.01em; }
.tb-wallet { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.w-item {
  background: rgba(0,0,0,.26); border-radius: 999px;
  padding: 4px 9px; font-size: 12px; font-weight: 700;
  display: inline-flex; align-items: center; gap: 3px;
  font-variant-numeric: tabular-nums;
}
.gem { color: var(--diamond); font-style: normal; font-size: 11px; }
</style>
