<template><span class="count-up">{{ prefix }}{{ shown }}{{ suffix }}</span></template>

<script setup>
/* A number that arrives rather than appears. Built here for the jackpot
   prize, and meant to be the same component the payout figure uses in step 6
   — hence the plain props and no jackpot in sight.

   It always lands exactly on `value`: a count-up that stops at 2,850,181
   because of float drift is worse than no count-up at all. */
import { ref, watch, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'

const props = defineProps({
  value: { type: Number, required: true },
  from: { type: Number, default: 0 },
  duration: { type: Number, default: 0.9 },
  delay: { type: Number, default: 0 },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' },
  /* off for the gate and for anyone who would rather just read the number */
  animate: { type: Boolean, default: true }
})

/* where the number is RIGHT NOW, so a value that changes mid-flight carries
   on from here instead of snapping back to `from` and starting again — which
   is what a ticking figure does every time it ticks */
let current = props.animate ? props.from : props.value
const shown = ref(format(current))
let tween = null

function format (v) { return Math.round(v).toLocaleString() }

function run () {
  if (tween) tween.kill()
  if (!props.animate) { current = props.value; shown.value = format(current); return }
  const box = { v: current }
  tween = gsap.to(box, {
    v: props.value,
    duration: props.duration,
    delay: props.delay,
    ease: 'power2.out',
    onUpdate: () => { current = box.v; shown.value = format(current) },
    onComplete: () => { current = props.value; shown.value = format(current) }
  })
}

onMounted(run)
watch(() => props.value, run)
onUnmounted(() => { if (tween) tween.kill() })
</script>

<style scoped>
.count-up { font-variant-numeric: tabular-nums; }
</style>
