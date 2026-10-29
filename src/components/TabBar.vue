<template>
  <nav class="tabbar" :class="{ reduced }" aria-label="Main navigation">
    <button v-for="t in tabs" :key="t.id" class="tab" :class="{ active: current === t.id }" :data-tab="t.id"
      :aria-current="current === t.id ? 'page' : undefined" :aria-label="t.dot ? `${t.label}, updates available` : t.label" @click="$emit('nav', t.id)">
      <span class="ic"><NavIcon :name="t.icon" /><i v-if="t.dot" class="tdot" aria-hidden="true"></i></span>
      <span class="lb">{{ t.label }}</span>
    </button>
  </nav>
</template>
<script setup>
import NavIcon from './NavIcon.vue'
import { reduced } from '../ui/motion.js'
defineProps({ tabs: Array, current: String })
defineEmits(['nav'])
</script>
<style scoped>
.tabbar { flex:0 0 var(--tabbar-h); height:var(--tabbar-h); background:linear-gradient(180deg,#1c2a36,#111d29); border-top:1px solid #9db6c739; display:flex; position:relative; z-index:20; box-shadow:0 -4px 18px #06101b33,inset 0 1px 0 #ffffff04; }
.tab { --nav-metal-hi:#e8f3fb; --nav-metal-mid:#adc5d9; --nav-metal-lo:#7c9bb4; --nav-fill-hi:#526c83; --nav-fill-lo:#243b50; flex:1; min-width:0; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; color:#aebed0; padding:3px 1px 2px; }
.ic { position:relative; display:flex; align-items:center; justify-content:center; width:32px; height:30px; flex:none; transition:filter .18s ease,transform .18s ease; }
.ic::before { content:''; position:absolute; inset:0 -5px; pointer-events:none; border-radius:11px; background:linear-gradient(145deg,#5aeba91e,#69dbac04); box-shadow:inset 0 0 0 1px #8af0ba20; opacity:0; transition:opacity .18s ease; }
.ic :deep(.nav-icon) { position:relative; z-index:1; }
.lb { font-size:10px; line-height:12px; font-weight:650; white-space:nowrap; letter-spacing:-.015em; }
.tab.active { --nav-metal-hi:#f1fff8; --nav-metal-mid:#a4f6cd; --nav-metal-lo:#50d992; --nav-fill-hi:#459c76; --nav-fill-lo:#174f3c; color:#f1fff8; }
.tab.active .ic { filter:drop-shadow(0 0 7px #5ee7a839); }.tab.active .ic::before { opacity:1; }
.tab.active::before { content:''; position:absolute; top:-1px; left:calc(50% - 14px); width:28px; height:2px; border-radius:0 0 3px 3px; background:linear-gradient(90deg,#40cf87,#a4ffd0,#40cf87); box-shadow:0 2px 10px #5be29b55; }
.tab.active .lb { font-weight:750; }.tab:active .ic { transform:scale(.94); }
.tdot { position:absolute; z-index:2; top:0; right:-1px; width:6px; height:6px; border-radius:50%; background:#ff5769; box-shadow:0 0 0 2px #1a2834,0 0 6px #ff516525; }
.tab:focus-visible { outline:2px solid #99eac2; outline-offset:-4px; border-radius:9px; }
.reduced .ic,.reduced .ic::before { transition:none; }.reduced .tab:active .ic { transform:none; }
@media(prefers-reduced-motion:reduce) { .ic,.ic::before { transition:none; }.tab:active .ic { transform:none; } }
</style>
