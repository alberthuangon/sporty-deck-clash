<template>
  <div class="cf" :class="[`r-${card.rarity}`, size, { sel: selected, dim: dim }]">
    <div class="cf-top">
      <span class="cf-rar">{{ card.rarity }}</span>
      <span class="cf-lv">Lv.{{ card.level }}</span>
    </div>
    <div class="cf-art">
      <RadarChart v-if="radar" :axis-keys="card.axisKeys" :values="card.axes" :size="artSize" />
      <div v-else class="cf-mono">{{ initials }}</div>
    </div>
    <div class="cf-name">{{ card.name }}</div>
    <div class="cf-role">{{ roleLabel }}<span class="cf-venue">{{ venueMark }}</span></div>
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import RadarChart from './RadarChart.vue'
import { ROLE_LABEL } from '../engine/cards.js'

const props = defineProps({
  card: { type: Object, required: true },
  size: { type: String, default: 'md' },       // sm | md | lg
  radar: { type: Boolean, default: true },
  selected: Boolean,
  dim: Boolean
})
const artSize = computed(() => ({ sm: 54, md: 74, lg: 116 }[props.size]))
const initials = computed(() => props.card.name.slice(0, 2).toUpperCase())
const roleLabel = computed(() => ROLE_LABEL[props.card.role])
const venueMark = computed(() =>
  props.card.venue === 'home' ? ' · H' : props.card.venue === 'away' ? ' · A' : '')
</script>

<style scoped>
.cf {
  position: relative;
  background: linear-gradient(170deg, var(--surface-hi), var(--surface) 62%);
  border: 1px solid var(--rc, var(--divider));
  border-radius: var(--r-md);
  padding: 6px 6px 8px;
  display: flex; flex-direction: column; align-items: center;
  overflow: hidden;
}
.cf::before {
  content: ''; position: absolute; inset: 0 0 auto; height: 3px;
  background: var(--rc, var(--divider));
}
.r-C { --rc: var(--r-c); }
.r-R { --rc: var(--r-r); }
.r-E { --rc: var(--r-e); }
.r-L { --rc: var(--r-l); }
.cf.sel { box-shadow: 0 0 0 2px var(--cta); }
.cf.dim { opacity: .4; }
.cf-top {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  font-size: 9px; font-weight: 700; margin-top: 2px;
}
.cf-rar {
  background: var(--rc); color: #0E1117; border-radius: 3px;
  padding: 0 4px; line-height: 13px;
}
.cf-lv { color: var(--text-2); }
/* flex: 1 so a card stretched by its grid cell grows around the art rather
   than leaving a gap under the role line */
.cf-art { display: flex; flex: 1; align-items: center; justify-content: center; margin: 2px 0; }
.cf-mono { font-size: 22px; font-weight: 800; color: var(--text-2); }
.cf-name { font-size: 12px; font-weight: 700; line-height: 1.2; text-align: center; }
.cf-role { font-size: 9px; color: var(--text-2); text-align: center; }
.cf-venue { color: var(--green); font-weight: 700; }
.sm .cf-name { font-size: 11px; }
.lg .cf-name { font-size: 16px; }
.lg .cf-role { font-size: 11px; }
</style>
