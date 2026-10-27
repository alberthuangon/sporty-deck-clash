<template>
  <svg
    class="pa" :class="'pa-' + kind" :style="style" viewBox="0 0 74 74"
    aria-hidden="true" focusable="false"
  ><g v-for="g in groups" :key="g.name" :class="'pa-' + g.name"
    ><component v-for="(p, i) in g.shapes" :key="i" :is="p[0]" v-bind="p[1]">{{ p[2] }}</component
  ></g></svg>
</template>

<script setup>
/* One player, drawn from src/ui/figures.js.

   Same shape as Icon.vue, for the same three reasons: no v-html, one place
   that owns size and aria, and the layout gate sees a real box. The art says
   nothing the card does not already say in words — name, role, rarity and
   level are all on the face — so it is aria-hidden.

   It renders LAYERS, not a flat list: <g class="pa-bg">, pa-rim, pa-body,
   pa-fg. The holo pass needs somewhere to put foil that is neither in front of
   everything nor behind everything, and it needs a shape to clip to; `mask` is
   the same silhouette in flat white, ready to drop inside a <mask>, and it is
   only emitted when asked for because nothing else has a use for it.

   Colour: only --fig-accent is set here, and it is the RARITY colour, because
   the band is the one place rarity is allowed to touch the art (gate:
   invariance group `rarity-ladder` — geometry may not depend on rarity, and
   four DIFFERENT cards are compared in the same place). Everything else — kit,
   skin, hair — belongs to the person and lives in figures.js. */
import { computed } from 'vue'
import { buildPortrait, buildFigure } from '../ui/figures.js'

const props = defineProps({
  cardId: { type: String, required: true },
  kind: { type: String, default: 'portrait' },   // portrait | figure
  tier: { type: String, default: 'md' },         // sm | md | lg — CardFace's own size
  rarity: { type: String, default: 'C' },
  size: { type: [Number, String], default: null },
  number: { type: [Number, String], default: null },
  mask: Boolean
})

const TIER_PX = { sm: 44, md: 74, lg: 116 }
const RARITY = { C: 'var(--r-c)', R: 'var(--r-r)', E: 'var(--r-e)', L: 'var(--r-l)' }

const layers = computed(() => props.kind === 'figure'
  ? buildFigure(props.cardId, props.tier, { number: props.number })
  : buildPortrait(props.cardId, props.tier))

const groups = computed(() => {
  const L = layers.value
  const out = [{ name: 'bg', shapes: L.bg }, { name: 'rim', shapes: L.rim },
    { name: 'body', shapes: L.body }, { name: 'fg', shapes: L.fg }]
  if (props.mask) out.push({ name: 'mask', shapes: L.mask })
  return out.filter(g => g.shapes.length)
})

const px = computed(() => {
  if (props.size == null) return TIER_PX[props.tier] + 'px'
  return typeof props.size === 'number' ? props.size + 'px' : props.size
})
const style = computed(() => ({
  width: px.value, height: px.value,
  '--fig-accent': RARITY[props.rarity] || RARITY.C
}))
</script>

<style scoped>
/* flex:none for the same reason Icon.vue has it — the art box is a flex child,
   and a shrinkable SVG is how a 44px figure quietly becomes a 38px one. */
.pa { display: block; flex: none; }
.pa-mask { display: none; }   /* only a <mask> consumer should paint it */
</style>
