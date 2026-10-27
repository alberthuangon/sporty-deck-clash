<template>
  <div
    class="holo" ref="rootEl"
    :style="vars"
    @pointerenter="onEnter"
    @pointermove="onMove"
    @pointerleave="onLeave"
    @pointerdown="onMove"
  >
    <div class="holo-tilt">
      <slot />
      <!-- Real elements, not pseudo-elements, and that is deliberate. A foil
           is a layer sitting over the card's own text; a pseudo-element would
           be invisible to every assertion in the layout gate, which is exactly
           the silent exception this project does not allow itself. These are
           visible to it, declared to it, and bounded by it — see the paired
           assertion in tools/layout/run.mjs. -->
      <i class="holo-foil" aria-hidden="true"></i>
      <i class="holo-glare" aria-hidden="true"></i>
    </div>
  </div>
</template>

<script setup>
/* The "shiny card" treatment — guide step 7, Albert's holo request.

   Written from the technique rather than from the reference implementation:
   pointer position becomes CSS variables, variables drive gradients and a 3D
   tilt. The well-known pokemon-cards-css project is GPL-3.0 and this demo is
   shown in public, so the method is borrowed and the code is not.

   Three things the reference does not have to solve and we do:

     1. no image files. Its foil and mask are textures; ours cannot be, since
        this app loads nothing external. The rainbow was always a gradient, so
        that part is free; what a texture buys is the MASK, and our artwork is
        drawn rather than photographed, so a shape we already own can mask it
        more precisely than a bitmap could.

     2. phones have no hover. The reference is a desktop mouse demo. This
        build gets passed around on phones, where "no pointer" is the normal
        case rather than the exception — so the card sweeps itself once when
        it appears, and answers touch-drag as well as a mouse. Without that a
        phone user would never learn the effect exists.

     3. reduced motion is a switch this project already owns. Held still, the
        card keeps a faint fixed sheen: the finish is information (it tracks
        rarity), so it should not vanish just because the movement does. */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { reduced } from '../ui/motion.js'

const props = defineProps({
  /* 0 = no foil at all, 1 = full. The rarity ladder drives this from the
     outside, so this component never needs to know what a rarity is. */
  intensity: { type: Number, default: 1 },
  /* degrees of tilt at the far edge */
  tilt: { type: Number, default: 9 }
})

const rootEl = ref(null)
/* where the light is, 0..1 in each axis, 0.5 being the middle */
const x = ref(0.5)
const y = ref(0.5)
const lit = ref(0)          // 0 = resting, 1 = fully lit
/* Tilt is tracked apart from light on purpose. The self-sweep moves the LIGHT
   and never the geometry, so a card nobody is touching is geometrically still
   — which matters because the layout gate compares the four rarities of this
   card against each other, and a box that is mid-rotation when it is measured
   makes that comparison non-reproducible. It drifted 0.2-0.3px before this
   split. Tilt answers a real pointer only, and a phone has none. */
const tilted = ref(0)
let vx = 0, vy = 0, vl = 0, vt = 0   // spring velocities
let target = { x: 0.5, y: 0.5, lit: 0, tilted: 0 }
let raf = 0
let sweep = null

/* A critically-damped-ish spring, stepped per frame. A spring rather than a
   transition because the input is a stream of positions, not a state change:
   easing between every pointer event reads as lag, while a spring just has
   weight. */
function step () {
  raf = 0
  const k = 0.14, d = 0.76
  let moving = false
  const go = (cur, tgt, v) => {
    const a = (tgt - cur.value) * k
    v = (v + a) * d
    cur.value += v
    if (Math.abs(v) > 0.0002 || Math.abs(tgt - cur.value) > 0.0008) moving = true
    return v
  }
  vx = go(x, target.x, vx)
  vy = go(y, target.y, vy)
  vl = go(lit, target.lit, vl)
  vt = go(tilted, target.tilted, vt)
  if (moving) raf = requestAnimationFrame(step)
}
function kick () { if (!raf) raf = requestAnimationFrame(step) }

function aim (cx, cy) {
  const el = rootEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return
  target.x = Math.min(1, Math.max(0, (cx - r.left) / r.width))
  target.y = Math.min(1, Math.max(0, (cy - r.top) / r.height))
  target.lit = 1
  target.tilted = 1
  kick()
}
function onEnter (e) { aim(e.clientX, e.clientY) }
function onMove (e) { aim(e.clientX, e.clientY) }
function onLeave () { target = { x: 0.5, y: 0.5, lit: 0, tilted: 0 }; kick() }

/* The card shows itself once on arrival, because on a phone nothing else
   ever will. One pass corner to corner, then it settles back. */
function autoSweep () {
  if (reduced.value) return
  const t0 = performance.now()
  const dur = 1500
  const run = now => {
    const p = Math.min(1, (now - t0) / dur)
    /* ease in and out so the pass has a direction rather than a start */
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    target.x = 0.12 + e * 0.76
    target.y = 0.78 - e * 0.56
    target.lit = Math.sin(p * Math.PI)
    kick()
    if (p < 1) sweep = requestAnimationFrame(run)
    else { sweep = null; target = { x: 0.5, y: 0.5, lit: 0, tilted: 0 }; kick() }
  }
  sweep = requestAnimationFrame(run)
}

onMounted(autoSweep)
watch(reduced, v => { if (v && sweep) { cancelAnimationFrame(sweep); sweep = null } })
onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  if (sweep) cancelAnimationFrame(sweep)
})

const vars = computed(() => {
  const amp = (reduced.value ? 0 : 1) * tilted.value
  const dx = x.value - 0.5
  const dy = y.value - 0.5
  return {
    '--hx': (x.value * 100).toFixed(2) + '%',
    '--hy': (y.value * 100).toFixed(2) + '%',
    '--hrx': (-dy * props.tilt * 2 * amp).toFixed(2) + 'deg',
    '--hry': (dx * props.tilt * 2 * amp).toFixed(2) + 'deg',
    /* resting sheen is deliberately not zero: held still, the finish still
       has to say which rarity this is */
    '--hl': (props.intensity * (0.28 + 0.72 * lit.value)).toFixed(3),
    '--hd': (Math.min(1, Math.hypot(dx, dy) * 2)).toFixed(3)
  }
})
</script>

<style scoped>
.holo { perspective: 700px; }
.holo-tilt {
  position: relative;
  transform: rotateX(var(--hrx, 0deg)) rotateY(var(--hry, 0deg));
  transform-style: preserve-3d;
  will-change: transform;
}
/* Both layers are clipped to the card and never take a tap. The card beneath
   keeps every one of its own hit targets. */
.holo-foil, .holo-glare {
  position: absolute; inset: 0;
  pointer-events: none;
  border-radius: var(--r-md);
  z-index: 3;
  opacity: var(--hl, 0);
}
/* The rainbow. Two bands crossing at an angle so the sweep never reads as one
   flat wipe, plus a fine diagonal rule that makes it behave like a printed
   foil rather than a coloured light. */
.holo-foil {
  background:
    repeating-linear-gradient(112deg,
      rgba(255, 119, 155, .22) 0%, rgba(255, 221, 119, .22) 7%,
      rgba(119, 255, 189, .22) 14%, rgba(119, 206, 255, .22) 21%,
      rgba(194, 119, 255, .22) 28%, rgba(255, 119, 155, .22) 35%),
    repeating-linear-gradient(68deg,
      rgba(255, 255, 255, .10) 0 3px, transparent 3px 9px);
  background-size: 260% 260%, auto;
  background-position: var(--hx, 50%) var(--hy, 50%), 0 0;
  mix-blend-mode: color-dodge;
  filter: saturate(1.5);
}
/* The specular highlight — one soft spot that follows the pointer. This is
   what sells the tilt; the rainbow alone reads as a sticker. */
.holo-glare {
  background: radial-gradient(
    farthest-corner circle at var(--hx, 50%) var(--hy, 50%),
    rgba(255, 255, 255, .34) 4%,
    rgba(255, 255, 255, .10) 28%,
    transparent 62%);
  mix-blend-mode: overlay;
}
</style>
