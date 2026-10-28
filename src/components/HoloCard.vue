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

   The first version let the tilt share that variable and the layout gate
   caught it: this card's four rarities are compared against each other, and a
   card that is always rotating measured 0.2-0.3px apart between them. The
   conclusion drawn then — "light drifts; geometry stays still" — was the
   cheap half of the fix. The expensive half is that the gate was sampling a
   moving thing at whatever moment it happened to look, and the answer to that
   is to name the moment, not to stop the movement. It now does (tools/layout
   pins the phase), so the geometry drifts too.

   ONE CLOCK. --holo-d runs -1 -> +1 -> -1 over seven seconds and everything
   that drifts is derived from it: the light's position, the tilt, the lean of
   the shadow. Two tracks that both say "where are we in the cycle" can come
   apart in a later edit and the symptom — light going one way, card going the
   other — is the exact thing this is for.

   And the derivation is not a new set of numbers. The drift's tilt IS the
   pointer formula evaluated at the drifting position, so the idle card is
   indistinguishable from one with a finger resting where the light is. That
   is what "same phase" means here, and it is why there is no second
   amplitude to keep in sync with the first. */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { reduced } from '../ui/motion.js'

const props = defineProps({
  /* 9deg at the far edge; the ladder's values live in tokens.css */
  tilt: { type: Number, default: 9 },
  idleAmplitude: { type:Number, default:1 },
  idleDuration: { type:Number, default:7 }
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
    /* the one tilt constant, shared with the drift's own amplitude in CSS so
       there is no second number to keep in step with this one */
    '--holo-tilt': props.tilt + 'deg',
    '--holo-idle-gain': props.idleAmplitude,
    '--holo-duration': props.idleDuration + 's',
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
   and the whole effect depends on it travelling.

   Only the CLOCK is animated, so only the clock has to be registered: --holo-d
   is a plain number and everything else is a calc on it. The old version
   animated the light's two coordinates directly and needed both registered;
   deriving them costs nothing and removes the possibility of the two tracks
   disagreeing about where in the cycle we are. */
@property --holo-d {
  syntax: '<number>'; inherits: true; initial-value: 0;
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
  animation: holo-idle var(--holo-duration, 7s) ease-in-out infinite;

  /* WHERE THE DRIFT IS LOOKING. 50% +/- 16% horizontally and +/- 8%
     vertically: over a third of the card one way and a sixth the other, which
     is a card held in a hand that is not quite still rather than a scanner
     sweeping it. */
  --holo-dx: calc(50% + var(--holo-d) * 16% * var(--holo-idle-gain, 1));
  --holo-dy: calc(50% + var(--holo-d) * 8% * var(--holo-idle-gain, 1));
  --holo-x: calc(var(--holo-dx) + (var(--holo-px, 50%) - var(--holo-dx)) * var(--holo-g));
  --holo-y: calc(var(--holo-dy) + (var(--holo-py, 50%) - var(--holo-dy)) * var(--holo-g));

  /* HOW FAR THE DRIFT TURNS THE CARD, and the numbers are not new ones.
     The pointer turns the card by (0.5 - x) * tilt * 2; evaluate that at the
     drift's own excursion — 0.16 of the card sideways, 0.08 up and down — and
     you get tilt * 0.32 and tilt * 0.16. So this is the same formula, applied
     to the place the light is already looking from, and there is exactly one
     tilt constant in the component (--holo-tilt, written by the script).
     At the default 9deg that is +/-2.9deg of yaw and +/-1.4 of pitch.
     Sideways dominates because that is the gesture: someone turning a card in
     their fingers to catch the light, not nodding it. */
  --holo-dry: calc(var(--holo-d) * var(--holo-tilt, 9deg) * -0.32 * var(--holo-idle-gain, 1));
  --holo-drx: calc(var(--holo-d) * var(--holo-tilt, 9deg) * 0.16 * var(--holo-idle-gain, 1));
  /* the same lean applied to the shadow's 14px, so the card and the thing it
     casts agree about which way it is facing */
  --holo-dsx: calc(var(--holo-d) * -2.24px);
  --holo-dsy: calc(var(--holo-d) * -1.12px);
}
/* The default state is MOVING, not off: a phone has no cursor, so "nothing is
   touching the card" is the normal case rather than the exception. Seven
   seconds there and back. A pointer or a tilted phone takes over while it is
   there and hands back when it goes. */
@keyframes holo-idle {
  0%   { --holo-d: -1; }
  50%  { --holo-d: 1; }
  100% { --holo-d: -1; }
}
/* Reduced motion stops the movement and keeps the finish: the foil carries
   rarity, so switching it off would tell those players their Legendary is a
   Common. One line does it now — with the clock stopped --holo-d falls back to
   its registered initial value of 0, which is the card square on and the light
   in the middle. */
.holo.still { animation: none; }

.holo :deep(.cf) {
  /* MIXED, not switched, exactly as the light above is: the drift's angle
     fades out as --holo-g fades in, so a finger arriving does not fight the
     idle sway and letting go eases back into it instead of snapping. The
     script has already multiplied its own half by g, which is why only the
     drift's half carries (1 - g). */
  transform:
    rotateX(calc(var(--holo-drx, 0deg) * (1 - var(--holo-g)) + var(--holo-rx, 0deg)))
    rotateY(calc(var(--holo-dry, 0deg) * (1 - var(--holo-g)) + var(--holo-ry, 0deg)));
  transform-style: preserve-3d;
  will-change: transform;
  /* the card's own drop shadow leans the other way as it turns — without it
     the card moves and its shadow does not, which reads as a sticker.
     0px rather than 0 in the fallbacks: a bare zero is unitless and adding it
     to a length inside calc makes the whole declaration invalid. */
  box-shadow:
    calc(var(--holo-dsx, 0px) * (1 - var(--holo-g)) + var(--holo-sx, 0px))
    calc(var(--holo-dsy, 0px) * (1 - var(--holo-g)) + var(--holo-sy, 4px))
    18px rgba(0,0,0,.5), var(--cf-shadow);
}
</style>
