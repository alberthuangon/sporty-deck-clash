<template>
  <img
    class="pa" :class="'pa-' + kind" :src="src"
    :width="box[0]" :height="box[1]" :style="style" alt="" aria-hidden="true"
    :loading="eager ? 'eager' : 'lazy'" decoding="async"
  >
</template>

<script setup>
/* One player, one picture.

   This used to draw the player from src/ui/figures.js — 691 lines of
   generative SVG that existed because the project could not load image files.
   That turned out to be a misreading of its own rule: the rule is no external
   CDN, and a file in src/assets is bundled into dist, same-origin, and works
   with the network unplugged. Twenty illustrations later the drawings are
   gone and so is the module.

   aria-hidden, as the drawing was: the art says nothing the card does not
   already say in words — name, role, rarity and level are all on the face.

   The width and height ATTRIBUTES are the intrinsic size, and they are not
   decoration. An <img> with no intrinsic ratio is a zero-height box until it
   loads and then everything below it drops into place — a bug the layout gate
   cannot photograph, because every state is measured after the page settles.
   It asserts the attributes instead (`images that reserve no space`). */
import { computed } from 'vue'
import { artFor, ART_BOX, ART_FOCUS } from '../ui/art.js'

const props = defineProps({
  cardId: { type: String, required: true },
  kind: { type: String, default: 'portrait' },   // portrait | figure
  tier: { type: String, default: 'md' },         // sm | md | lg — CardFace's own size
  size: { type: [Number, String], default: null },
  /* the card being looked at loads now; twenty in a grid can wait */
  eager: Boolean,
  /* The PARENT owns the box. Without this the tier width and height are
     written inline, and an inline style beats any class the card can bring —
     which is how a 640x896 illustration first rendered as a 116px square
     sitting in the top third of a 5:7 card. */
  fill: Boolean
})

/* Display sizes for the portrait, which is still a fixed square in a grid
   cell and in the shootout. The figure has no entry: it fills a 5:7 card and
   the card decides how big that is. */
const TIER_PX = { sm: 44, md: 74 }

const src = computed(() => artFor(props.cardId, props.kind))
const box = computed(() => ART_BOX[props.kind] || ART_BOX.portrait)
const px = computed(() => {
  if (props.size == null) return (TIER_PX[props.tier] || TIER_PX.md) + 'px'
  return typeof props.size === 'number' ? props.size + 'px' : props.size
})
/* object-position only matters while the parent is cropping this image, and
   the parent only crops it when it owns the box — so it rides with `fill`
   rather than being set unconditionally. See ART_FOCUS for why one card has
   one and nineteen do not. */
const style = computed(() => (props.fill
  ? (ART_FOCUS[props.cardId] ? { objectPosition: ART_FOCUS[props.cardId] } : {})
  : { width: px.value, height: px.value }))
</script>

<style scoped>
/* flex:none for the same reason Icon.vue has it — the art box is a flex child,
   and a shrinkable image is how a 44px player quietly becomes a 38px one. */
.pa { display: block; flex: none; }
/* object-fit, not letterboxing: the art and the card are both 5:7, but either
   one rounding to a half pixel is enough to show a seam, and `cover` loses a
   sliver where `contain` would show a bar. */
.pa { object-fit: cover; }
</style>
