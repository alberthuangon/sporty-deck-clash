<template>
  <div
    class="holo" ref="rootEl"
    :class="{ held: held, still: reduced }"
    :style="vars"
    @pointerenter="onMove"
    @pointermove="onMove"
    @pointerdown="onMove"
    @pointerleave="onLeave"
    @pointercancel="onLeave"
  >
    <slot />
  </div>
</template>

<script setup>
/* The laminated / foiled card — Albert's holo request.

   Built from the technique rather than from the reference implementation:
   pointer position becomes CSS variables and the variables drive gradients
   and a tilt. pokemon-cards-css is GPL-3.0 and this demo is shown in public,
   so the method is borrowed and the code is not. Its foil and mask are image
   files, which this app cannot load at all.

   TWO VARIABLES, NOT ONE, and the split is not a style choice.

   The obvious design drives both the light and the tilt from one pointer
   position. But the finish has to be alive with NO pointer — a phone has
   none, so "nothing is touching the card" is the normal case rather than the
   exception, and a card that only shines when hovered is a dead card to most
   of the people who will see it. So the light drifts on its own.

   If the tilt shared that variable, the card would be rotating forever, and
   a card that is always rotating cannot be measured: the layout gate compares
   this card's four rarities against each other and caught exactly that,
   0.2-0.3px of drift, when the first version tilted during its sweep. Light
   drifts; geometry stays still until something actually touches it. */
import { ref, computed, onBeforeUnmount } from 'vue'
import { reduced } from '../ui/motion.js'

const props = defineProps({
  /* 9deg at the far edge; the ladder's values live in tokens.css */
  tilt: { type: Number, default: 9 }
})

const rootEl = ref(null)
const held = ref(false)          // is something actually pointing at it
const px = ref(0.5)
const py = ref(0.5)
const grip = ref(0)              // springs 0 -> 1 while held, so tilt eases in
let vx = 0, vy = 0, vg = 0
let target = { x: 0.5, y: 0.5, grip: 0 }
let raf = 0

/* A spring rather than a transition: the input is a stream of positions, not
   a state change, and easing between every pointer event reads as lag. */
function step () {
  raf = 0
  const k = 0.16, d = 0.74
  let moving = false
  const go = (cur, tgt, v) => {
    v = (v + (tgt - cur.value) * k) * d
    cur.value += v
    if (Math.abs(v) > 0.0002 || Math.abs(tgt - cur.value) > 0.0008) moving = true
    return v
  }
  vx = go(px, target.x, vx)
  vy = go(py, target.y, vy)
  vg = go(grip, target.grip, vg)
  if (moving) raf = requestAnimationFrame(step)
}
function kick () { if (!raf) raf = requestAnimationFrame(step) }

function onMove (e) {
  const el = rootEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return
  target.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  target.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  target.grip = 1
  held.value = true
  kick()
}
function onLeave () {
  target = { x: 0.5, y: 0.5, grip: 0 }
  held.value = false
  kick()
}
onBeforeUnmount(() => { if (raf) cancelAnimationFrame(raf) })

const vars = computed(() => {
  const g = reduced.value ? 0 : grip.value
  return {
    /* only written while held — otherwise the CSS drift owns these */
    ...(held.value ? {
      '--holo-x': (px.value * 100).toFixed(2) + '%',
      '--holo-y': (py.value * 100).toFixed(2) + '%'
    } : {}),
    '--holo-rx': ((py.value - 0.5) * props.tilt * 2 * g).toFixed(2) + 'deg',
    '--holo-ry': ((0.5 - px.value) * props.tilt * 2 * g).toFixed(2) + 'deg',
    '--holo-sx': ((px.value - 0.5) * -14 * g).toFixed(1) + 'px',
    '--holo-sy': ((py.value - 0.5) * -14 * g + 4).toFixed(1) + 'px'
  }
})
</script>

<style scoped>
/* Registered so the drift can INTERPOLATE. An unregistered custom property
   animates discretely — it would jump at the midpoint instead of travelling,
   and the whole effect depends on it travelling. */
@property --holo-x {
  syntax: '<percentage>'; inherits: true; initial-value: 50%;
}
@property --holo-y {
  syntax: '<percentage>'; inherits: true; initial-value: 50%;
}

.holo {
  perspective: 700px;
  --holo-on: 1;
  animation: holo-idle 7s ease-in-out infinite;
}
/* The default state is MOVING, not off. Seven seconds there and back, over a
   third of the card rather than all of it: this is a card held in a hand that
   is not quite still, not a scanner sweeping. A pointer takes over while it
   is there and hands back when it leaves. */
@keyframes holo-idle {
  0%   { --holo-x: 34%; --holo-y: 42%; }
  50%  { --holo-x: 66%; --holo-y: 58%; }
  100% { --holo-x: 34%; --holo-y: 42%; }
}
.holo.held { animation-play-state: paused; }
/* Reduced motion stops the movement and keeps the finish: the foil carries
   rarity, so switching it off would tell those players their Legendary is a
   Common. */
.holo.still { animation: none; --holo-x: 50%; --holo-y: 50%; }

.holo :deep(.cf) {
  transform: rotateX(var(--holo-rx, 0deg)) rotateY(var(--holo-ry, 0deg));
  transform-style: preserve-3d;
  will-change: transform;
  /* the card's own drop shadow leans the other way as it turns — without it
     the card moves and its shadow does not, which reads as a sticker */
  box-shadow: var(--holo-sx, 0) var(--holo-sy, 4px) 18px rgba(0,0,0,.5), var(--cf-shadow);
}
</style>
