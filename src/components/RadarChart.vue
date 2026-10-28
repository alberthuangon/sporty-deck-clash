<template>
  <svg :viewBox="`0 0 ${size} ${size}`" :width="size" :height="size" class="radar">
    <polygon v-for="r in rings" :key="r" :points="ringPoints(r)" class="ring" />
    <line v-for="(k,i) in axisKeys" :key="'a'+k" class="spoke"
          :x1="c" :y1="c" :x2="pt(i,1).x" :y2="pt(i,1).y" />
    <polygon v-if="ghost" :points="poly(ghost)" class="ghost" />
    <!-- shape and nodes read `shown`, which is `values` except while a morph
         is running. The LABELS below read `values` directly and are never
         animated: §2.1 says the new number appears at once and the picture
         can take its time, not the other way round. -->
    <polygon ref="shapeEl" :points="poly(shown)" class="shape" />
    <circle v-for="(k,i) in axisKeys" :key="'d'+k" class="node"
            :cx="pt(i, shown[k]/max).x" :cy="pt(i, shown[k]/max).y" r="2" />
    <g v-if="labels">
      <text v-for="(k,i) in axisKeys" :key="'t'+k" class="lbl"
            :x="pt(i,1.22).x" :y="pt(i,1.22).y + 3"
            :text-anchor="anchor(i)">{{ k }}</text>
      <!-- The gain sits WITH the number it changes, which is the whole point
           of folding the table into the chart: the same figure was on screen
           twice, in the same scroll.

           EVERY axis renders a gain, including the ones that gain nothing.
           The table used to say "75 · unchanged" out loud, and if an axis
           with no gain simply showed nothing here then "this stat does not
           improve" and "the delta failed to render" would look identical —
           blank is not a message. A muted +0 is one.

           dx, not a space: SVG collapses leading whitespace in text content,
           so a space written in the template renders as "64+2". -->
      <text v-for="(k,i) in axisKeys" :key="'v'+k" class="val"
            :x="pt(i,1.22).x" :y="pt(i,1.22).y + 13"
            :text-anchor="anchor(i)">{{ values[k]
        }}<tspan v-if="deltas" dx="2.5" :class="deltas[k] ? 'up' : 'flat'">{{ deltas[k] ? '+' + deltas[k] : '+0' }}</tspan></text>
    </g>
  </svg>
</template>

<script setup>
import { computed, reactive, ref, watch, onUnmounted } from 'vue'
import gsap from 'gsap'
import { uiPlay, UI_TIME } from '../ui/motion.js'
const props = defineProps({
  axisKeys: { type: Array, required: true },
  values: { type: Object, required: true },
  ghost: { type: Object, default: null },
  size: { type: Number, default: 150 },
  max: { type: Number, default: 100 },
  labels: { type: Boolean, default: false },
  /* axis key -> how much the next level adds. Null leaves the chart exactly
     as every other caller has it; only the upgrade screen passes one. */
  deltas: { type: Object, default: null }
})
/* Where the shape is RIGHT NOW. Normally just a mirror of `values` — every
   card in every grid renders one of these and none of them animates — and
   only during a morph does it lag behind on purpose. */
const shown = reactive({})
const shapeEl = ref(null)
let anim = null
function sync () { props.axisKeys.forEach(k => { shown[k] = props.values[k] || 0 }) }
sync()
watch(() => props.axisKeys.map(k => props.values[k]).join(','), () => { if (!anim) sync() })

/* Animate from a PREVIOUS set of axes to the current ones. The caller hands
   over the old values because by the time it can ask, `values` is already the
   new card: the upgrade has happened, the numbers on screen have updated, and
   only the picture is still catching up. An axis that gained nothing does not
   move, because its old value and its new value are the same number. */
function morph (fromVals) {
  if (anim) anim.cancel()
  const box = {}
  props.axisKeys.forEach(k => { box[k] = fromVals && fromVals[k] != null ? fromVals[k] : (props.values[k] || 0) })
  Object.assign(shown, box)
  const to = { duration: UI_TIME.radar, ease: 'power2.inOut' }
  props.axisKeys.forEach(k => { to[k] = props.values[k] || 0 })
  anim = uiPlay('radar', tl => {
    tl.to(box, {
      ...to,
      onUpdate: () => { props.axisKeys.forEach(k => { shown[k] = box[k] }) }
    }, 0)
    /* One level is about a 2% move per axis — truthful, and almost invisible.
       The stroke thickens and settles so the eye is told where to look. It
       does NOT overshoot the values: a chart that briefly draws numbers the
       card does not have is a chart that lied, however briefly. */
    if (shapeEl.value) {
      tl.to(shapeEl.value, { strokeWidth: 3, duration: UI_TIME.radar * 0.35, ease: 'power2.out' }, 0)
      tl.to(shapeEl.value, { strokeWidth: 1.6, duration: UI_TIME.radar * 0.45, ease: 'power2.inOut' }, UI_TIME.radar * 0.4)
    }
  }, { onEnd: () => { anim = null; sync(); if (shapeEl.value) gsap.set(shapeEl.value, { clearProps: 'strokeWidth' }) } })
  return anim
}
onUnmounted(() => { if (anim) anim.cancel() })

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
defineExpose({ poly, morph })
</script>

<style scoped>
.radar { display: block; overflow: visible; }
.ring { fill: none; stroke: rgba(255,255,255,.09); stroke-width: 1; }
.spoke { stroke: rgba(255,255,255,.09); stroke-width: 1; }
/* The shape takes its colour from the context it sits in — CardFace sets
   --radar-c / --radar-fill per rarity. Defaults keep every other caller
   exactly as it was. Green is this product's "win / positive / CTA" colour, so
   spending it on a stat chart was spending a semantic colour on decoration. */
.shape { fill: var(--radar-fill, rgba(50,206,98,.26)); stroke: var(--radar-c, var(--green)); stroke-width: 1.6; stroke-linejoin: round; }
.ghost { fill: none; stroke: var(--cta); stroke-width: 1.4; stroke-dasharray: 3 3; opacity: .85; }
/* the ghost KEEPS mint: rarity says what you are, green says what you gain */
.node { fill: var(--radar-c, var(--green)); }
.lbl { font-size: 8px; fill: var(--text-2); font-weight: 700; letter-spacing: .03em; }
.val { font-size: 9px; fill: #fff; font-weight: 700; }
/* mint for a gain, matching the dashed next-level polygon it is describing —
   rarity says what the card IS, green says what it gains, the same split the
   ghost line already makes */
.val .up { fill: var(--cta); }
.val .flat { fill: var(--text-3, #6B7080); }
</style>
