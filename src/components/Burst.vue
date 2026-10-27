<template>
  <!-- No v-if anywhere in here, deliberately. The jackpot shards used to sit
       behind v-if="won", so a component that mounted on a losing draw and then
       saw a winning one animated against nothing at all — the third time this
       repo shipped an animation pointed at an element that did not exist. The
       shards are always in the DOM and always at opacity 0; the only thing
       play() needs to be true is already true. -->
  <div class="burst" ref="root" aria-hidden="true">
    <i v-for="n in count" :key="n"></i>
  </div>
</template>

<script setup>
/* The promotion burst, §10 step 6 item 1. Grey-box on purpose: squares, not
   confetti, until step 7 replaces the art. What is being tuned here is the
   rhythm, and a square tells you the rhythm is wrong just as clearly.

   Replaces the placeholder that DrawResult.vue carried for the jackpot win
   (PRD §6.7.2 said it was waiting for this), so the two celebrations are one
   piece of code with one budget. */
import { ref, onUnmounted } from 'vue'
import gsap from 'gsap'
import { uiPlay, UI_TIME } from '../ui/motion.js'

const props = defineProps({
  count: { type: Number, default: 18 },
  radius: { type: Number, default: 160 },
  /* which budget row this spends from (src/ui/motion.js) */
  name: { type: String, default: 'rankUp' }
})

const root = ref(null)

function reach (i) { return 0.5 + ((i * 7) % 11) / 10 * 0.5 }

/* The shards as a sub-timeline, so a caller can fold them into a bigger
   reaction (the rank-up takeover lands its headline on the same clock) and
   still have ONE timeline measured against ONE budget. */
function timeline (at = 0) {
  const tl = gsap.timeline()
  if (!root.value) return tl
  const bits = [...root.value.children]
  const dur = UI_TIME[props.name]
  /* A stagger EXTENDS the timeline: 20 shards 0.024s apart added 0.46s to a
     1.22s burst and put it over its 1.4s cap. The window has to be carved out
     of the budget, not added to it — so the last shard to leave still lands
     on time. The gate caught this; reading the code did not. */
  const spread = dur * 0.22
  const each = dur - spread
  gsap.set(bits, { clearProps: 'all' })
  tl.fromTo(bits,
    { scale: 0.2, opacity: 1, x: 0, y: 0 },
    {
      scale: 1, opacity: 0,
      duration: each, ease: 'power2.out',
      stagger: bits.length > 1 ? spread / (bits.length - 1) : 0,
      /* Every shard travelling the same distance on the same ease reads as
         an expanding RING, not a burst — the first capture showed a neat
         circle of dots. The spread is deterministic (indexed, not random) so
         the gate photographs the same frame twice. */
      x: i => Math.cos((i / bits.length) * Math.PI * 2) * props.radius * reach(i),
      y: i => Math.sin((i / bits.length) * Math.PI * 2) * props.radius * reach(i)
    }, at)
  return tl
}

/* Standalone play, for a caller with nothing else to say. */
let anim = null
function play () {
  anim = uiPlay(props.name, tl => tl.add(timeline()), {
    interruptible: UI_TIME[props.name] > 1
  })
  return anim
}

/* An overlay dismissed mid-burst used to leave the interrupt surface behind,
   and that surface covers the whole frame — every tap after it went nowhere.
   The gate found it two screens later, on Edit Squad. */
onUnmounted(() => { if (anim) anim.cancel() })

defineExpose({ play, timeline })
</script>

<style scoped>
.burst { position: absolute; left: 50%; top: 32%; pointer-events: none; }
.burst i {
  position: absolute; width: 8px; height: 8px; margin: -4px;
  border-radius: 2px; background: var(--cta); opacity: 0;
}
</style>
