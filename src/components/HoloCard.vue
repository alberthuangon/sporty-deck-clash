<template>
  <div
    class="holo" ref="rootEl"
    :class="{ still: reduced }"
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { reduced } from '../ui/motion.js'

const props = defineProps({
  /* 9deg at the far edge; the ladder's values live in tokens.css */
  tilt: { type: Number, default: 9 }
})

const rootEl = ref(null)
const held = ref(false)          // is something actually pointing at it
const gyro = ref(false)          // is the phone itself driving it
const px = ref(0.5)
const py = ref(0.5)
const grip = ref(0)              // springs 0 -> 1 while driven, so tilt eases in
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
  askTilt()
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
  held.value = false
  /* Hand back to the gyroscope if the phone is still being held, not to the
     middle — letting go on a tilted phone should leave the card pointing
     where the phone points, not snap it flat and then lean back. */
  if (gyro.value) return
  target = { x: 0.5, y: 0.5, grip: 0 }
  kick()
}

/* THE PHONE IS THE POINTER.

   This build gets handed to people on their own phones, where there is no
   cursor at all: every mouse path above is dead code to them. Two routes in,
   and they are not alternatives — most phones give both.

   1. DRAG. A finger already arrives through the pointer events above, but it
      arrives and is taken straight back: the card sits inside a scroller, so
      the browser claims the gesture and sends pointercancel. `touch-action:
      pan-y` (in the CSS below) splits it — up and down stays with the page so
      the screen still scrolls, sideways is ours. One axis, honestly: a card
      that eats the scroll to win a second axis is a worse card.

   2. TILT. deviceorientation, which is what a real laminated card responds
      to. iOS 13+ needs requestPermission() and needs it from a user gesture,
      so it is asked for on the first touch rather than on mount — mounting is
      not a gesture and the call is rejected. Android fires without asking.

   Unlike the pointer, tilt drives the GEOMETRY as well as the light, and that
   is safe for the same reason it is wanted: the gate cannot fire a
   deviceorientation event, so the rarity ladder is still measured on a card
   that is standing still, while a real phone gets a card that leans with it. */
const TILT_RANGE = 22            // degrees of phone for the full sweep
let base = null                  // where the phone was when it first spoke
let idle = 0
let asked = false

function askTilt () {
  if (asked) return
  asked = true
  const D = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null
  if (D && typeof D.requestPermission === 'function') {
    D.requestPermission().catch(() => {})
  }
}

function onTilt (e) {
  if (e.beta == null && e.gamma == null) return
  const b = e.beta || 0, g = e.gamma || 0
  /* Baselined, not absolute: a phone gets read at whatever angle its owner
     happens to hold it, and an absolute mapping pegs the card into one corner
     before they have moved at all. */
  if (!base) base = { b, g }
  const to01 = v => Math.min(1, Math.max(0, v / (TILT_RANGE * 2) + 0.5))
  gyro.value = true
  clearTimeout(idle)
  /* A phone lying face-up on a table stops sending anything. Without this the
     card freezes at its last angle instead of going back to its own drift. */
  idle = setTimeout(() => { gyro.value = false; base = null; onLeave() }, 1600)
  if (held.value) return         // a finger beats the phone while it is there
  target.x = to01(g - base.g)
  target.y = to01(b - base.b)
  target.grip = 1
  kick()
}

onMounted(() => { window.addEventListener('deviceorientation', onTilt) })
onBeforeUnmount(() => {
  window.removeEventListener('deviceorientation', onTilt)
  clearTimeout(idle)
  if (raf) cancelAnimationFrame(raf)
})

const vars = computed(() => {
  const g = reduced.value ? 0 : grip.value
  return {
    /* The light is MIXED, not switched. The first version wrote --holo-x
       directly and paused the drift while something was holding the card, and
       reading the computed style is what showed that it never worked: a CSS
       animation outranks an inline style, and a PAUSED animation still
       applies its value, so the pointer moved the tilt and the light stayed
       exactly where the drift had left it. Now the drift owns --holo-dx, the
       pointer owns --holo-px, and --holo-g crossfades them in CSS. Nothing
       overrides anything, and letting go fades back to the drift instead of
       cutting to it. */
    '--holo-px': (px.value * 100).toFixed(2) + '%',
    '--holo-py': (py.value * 100).toFixed(2) + '%',
    '--holo-g': g.toFixed(4),
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
@property --holo-dx {
  syntax: '<percentage>'; inherits: true; initial-value: 50%;
}
@property --holo-dy {
  syntax: '<percentage>'; inherits: true; initial-value: 50%;
}
@property --holo-g {
  syntax: '<number>'; inherits: true; initial-value: 0;
}
@property --holo-x {
  syntax: '<percentage>'; inherits: true; initial-value: 50%;
}
@property --holo-y {
  syntax: '<percentage>'; inherits: true; initial-value: 50%;
}

.holo {
  perspective: 700px;
  --holo-on: 1;
  /* up and down still scrolls the page; sideways is the card's */
  touch-action: pan-y;
  animation: holo-idle 7s ease-in-out infinite;
  --holo-x: calc(var(--holo-dx) + (var(--holo-px, 50%) - var(--holo-dx)) * var(--holo-g));
  --holo-y: calc(var(--holo-dy) + (var(--holo-py, 50%) - var(--holo-dy)) * var(--holo-g));
}
/* The default state is MOVING, not off. Seven seconds there and back, over a
   third of the card rather than all of it: this is a card held in a hand that
   is not quite still, not a scanner sweeping. A pointer or a tilted phone
   takes over while it is there and hands back when it goes. */
@keyframes holo-idle {
  0%   { --holo-dx: 34%; --holo-dy: 42%; }
  50%  { --holo-dx: 66%; --holo-dy: 58%; }
  100% { --holo-dx: 34%; --holo-dy: 42%; }
}
/* Reduced motion stops the movement and keeps the finish: the foil carries
   rarity, so switching it off would tell those players their Legendary is a
   Common. */
.holo.still { animation: none; --holo-dx: 50%; --holo-dy: 50%; }

.holo :deep(.cf) {
  transform: rotateX(var(--holo-rx, 0deg)) rotateY(var(--holo-ry, 0deg));
  transform-style: preserve-3d;
  will-change: transform;
  /* the card's own drop shadow leans the other way as it turns — without it
     the card moves and its shadow does not, which reads as a sticker */
  box-shadow: var(--holo-sx, 0) var(--holo-sy, 4px) 18px rgba(0,0,0,.5), var(--cf-shadow);
}
</style>
