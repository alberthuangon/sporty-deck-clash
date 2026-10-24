<template>
  <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size" class="radar">
    <polygon v-for="r in rings" :key="r" :points="ringPoints(r)" class="ring" />
    <line v-for="(k,i) in axisKeys" :key="'a'+k" class="spoke"
          :x1="c" :y1="c" :x2="pt(i,1).x" :y2="pt(i,1).y" />
    <polygon v-if="ghost" :points="poly(ghost)" class="ghost" />
    <polygon :points="poly(values)" class="shape" />
    <circle v-for="(k,i) in axisKeys" :key="'d'+k" class="node"
            :cx="pt(i, values[k]/max).x" :cy="pt(i, values[k]/max).y" r="2" />
    <g v-if="labels">
      <text v-for="(k,i) in axisKeys" :key="'t'+k" class="lbl"
            :x="pt(i,1.22).x" :y="pt(i,1.22).y + 3"
            :text-anchor="anchor(i)">{{ k }}</text>
      <text v-for="(k,i) in axisKeys" :key="'v'+k" class="val"
            :x="pt(i,1.22).x" :y="pt(i,1.22).y + 13"
            :text-anchor="anchor(i)">{{ values[k] }}</text>
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  axisKeys: { type: Array, required: true },
  values: { type: Object, required: true },
  ghost: { type: Object, default: null },
  size: { type: Number, default: 150 },
  max: { type: Number, default: 100 },
  labels: { type: Boolean, default: false }
})
const c = computed(() => props.size / 2)
const radius = computed(() => props.size / 2 * (props.labels ? 0.64 : 0.86))
const rings = [0.25, 0.5, 0.75, 1]

function pt (i, f) {
  const a = (Math.PI * 2 * i) / props.axisKeys.length - Math.PI / 2
  return { x: c.value + Math.cos(a) * radius.value * f, y: c.value + Math.sin(a) * radius.value * f }
}
function ringPoints (f) {
  return props.axisKeys.map((_, i) => { const p = pt(i, f); return `${p.x},${p.y}` }).join(' ')
}
function poly (vals) {
  return props.axisKeys.map((k, i) => {
    const p = pt(i, Math.max(0.02, (vals[k] || 0) / props.max))
    return `${p.x},${p.y}`
  }).join(' ')
}
function anchor (i) {
  const p = pt(i, 1)
  if (Math.abs(p.x - c.value) < 2) return 'middle'
  return p.x > c.value ? 'start' : 'end'
}
defineExpose({ poly })
</script>

<style scoped>
.radar { display: block; overflow: visible; }
.ring { fill: none; stroke: rgba(255,255,255,.09); stroke-width: 1; }
.spoke { stroke: rgba(255,255,255,.09); stroke-width: 1; }
.shape { fill: rgba(50,206,98,.26); stroke: var(--green); stroke-width: 1.6; stroke-linejoin: round; }
.ghost { fill: none; stroke: var(--cta); stroke-width: 1.4; stroke-dasharray: 3 3; opacity: .85; }
.node { fill: var(--green); }
.lbl { font-size: 8px; fill: var(--text-2); font-weight: 700; letter-spacing: .03em; }
.val { font-size: 9px; fill: #fff; font-weight: 700; }
</style>
