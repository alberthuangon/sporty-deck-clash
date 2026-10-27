<template><span class="count-up">{{ prefix }}{{ shown }}{{ suffix }}</span></template>

<script setup>
/* A number that arrives rather than appears. Built for the jackpot prize and
   meant to be the same component the payout figure uses — hence the plain
   props and no jackpot in sight.

   It always lands exactly on `value`: a count-up that stops at 2,850,181
   because of float drift is worse than no count-up at all.

   Two things it must not do, both from §2.1 — an animation decorates
   information, it never gates it:
     - it may not make the figure unreadable while it runs. That is what
       `from` is for: rolling a payout up from the STAKE means the magnitude
       is right in the first frame, and the roll says "this is what your
       stake became" instead of hiding the answer for 0.8s.
     - it may not move anything. tabular-nums below, and the payout-figure
       invariance group in the layout gate, which holds the money card
       mid-roll against the money card at rest. */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { uiPlay, UI_TIME, reduced } from '../ui/motion.js'

const props = defineProps({
  value: { type: Number, required: true },
  from: { type: Number, default: 0 },
  /* null = spend from the budget dial, so MotionLab retunes every rolling
     figure at once rather than one hard-coded duration at a time */
  duration: { type: Number, default: null },
  delay: { type: Number, default: 0 },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' },
  /* off for a figure that is not an event — a loss shows the stake, and a
     stake has not gone anywhere */
  animate: { type: Boolean, default: true },
  budget: { type: String, default: 'payout' }
})

const moving = computed(() => props.animate && !reduced.value)

/* where the number is RIGHT NOW, so a value that changes mid-flight carries
   on from here instead of snapping back to `from` and starting again — which
   is what a ticking figure does every time it ticks */
let current = moving.value ? props.from : props.value
const shown = ref(format(current))
let anim = null

function format (v) { return Math.round(v).toLocaleString() }

function run () {
  if (anim) { anim.cancel(); anim = null }
  if (!moving.value) { current = props.value; shown.value = format(current); return }
  const box = { v: current }
  anim = uiPlay(props.budget, tl => {
    tl.to(box, {
      v: props.value,
      duration: props.duration === null ? UI_TIME[props.budget] : props.duration,
      delay: props.delay,
      ease: 'power2.out',
      onUpdate: () => { current = box.v; shown.value = format(current) },
      onComplete: () => { current = props.value; shown.value = format(current) }
    })
  })
}

onMounted(run)
watch(() => props.value, run)
watch(moving, run)
onUnmounted(() => { if (anim) anim.cancel() })
</script>

<style scoped>
.count-up { font-variant-numeric: tabular-nums; }
</style>
