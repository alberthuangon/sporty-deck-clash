<template>
  <!-- Two layers holding the SAME content, each clipped to its side of the
       rip, so the pack reads as one card until it stops being one. Both are
       always in the DOM: nothing the timeline touches is behind a v-if. -->
  <div class="seal" ref="sealEl" @click="tear">
    <div class="seal-half top" ref="tearA">
      <div class="seal-in">
        <div class="seal-top">{{ title }}</div>
        <div class="seal-mid">◆ {{ price }}</div>
        <div class="seal-hint muted">{{ hint }}</div>
      </div>
    </div>
    <div class="seal-half bot" ref="tearB">
      <div class="seal-in">
        <div class="seal-top">{{ title }}</div>
        <div class="seal-mid">◆ {{ price }}</div>
        <div class="seal-hint muted">{{ hint }}</div>
      </div>
    </div>
    <div class="seal-rip" ref="ripEl"></div>
  </div>
</template>

<script setup>
/* The sealed pack and the tear that opens it — step 6 item 5.

   A TAP, not a drag. A real gesture can only be judged by feel, and the one
   person who has to sign it off is usually not at the machine; a tap reads
   almost the same on stage and can be photographed frame by frame.

   Lives here rather than in PackOpen so the motion lab can replay it while
   its slider moves — the same reason Burst is a component. */
import { ref, onUnmounted } from 'vue'
import gsap from 'gsap'
import { uiPlay, UI_TIME } from '../ui/motion.js'

defineProps({
  title: { type: String, default: 'Pack' },
  price: { type: [Number, String], default: 0 },
  hint: { type: String, default: 'tap to tear' }
})
const emit = defineEmits(['torn'])

const sealEl = ref(null)
const tearA = ref(null)
const tearB = ref(null)
const ripEl = ref(null)
let anim = null
let alive = true

function reset () {
  if (anim) { anim.cancel(); anim = null }
  gsap.set([sealEl.value, tearA.value, tearB.value, ripEl.value].filter(Boolean), { clearProps: 'all' })
}

/* A second tap skips rather than starting another. That matters more here
   than anywhere else: a pack is opened dozens of times in a session, and the
   second one is already too slow. */
function tear () {
  if (anim && !anim.record.done) { anim.skip(); return }
  if (anim) return
  const d = UI_TIME.tear
  anim = uiPlay('tear', tl => {
    tl.fromTo(ripEl.value, { opacity: 0, scaleX: 0.2 },
      { opacity: 1, scaleX: 1, duration: d * 0.18, ease: 'power2.out' }, 0)
    tl.to(sealEl.value, { scale: 0.96, duration: d * 0.12, ease: 'power2.out' }, 0)
    tl.to(sealEl.value, { scale: 1, duration: d * 0.18, ease: 'power2.inOut' }, d * 0.12)
    /* The halves land exactly ON the dial: `tear` is "tap -> first card
       visible", so a timeline that finishes early makes the number a
       decoration and the lab's slider a lie.

       power1.in rather than power2.in. The steeper ease was truer to how
       paper gives way, and it spent the first 0.4s of a 0.92s animation
       looking like nothing was happening — on the one screen a player
       revisits dozens of times a session. They also recede as they go, so
       the bottom half stops sliding across the button underneath it. */
    tl.to(tearA.value, { y: -70, x: -16, rotate: -9, scale: 0.94, duration: d * 0.84, ease: 'power1.in' }, d * 0.16)
    tl.to(tearB.value, { y: 56, x: 14, rotate: 7, scale: 0.94, duration: d * 0.84, ease: 'power1.in' }, d * 0.16)
    tl.to([tearA.value, tearB.value], { opacity: 0, duration: d * 0.5, ease: 'power1.in' }, d * 0.5)
    tl.to(ripEl.value, { opacity: 0, scaleY: 3.4, duration: d * 0.4, ease: 'power2.out' }, d * 0.4)
  }, {
    interruptible: true,
    onEnd: () => { if (alive) emit('torn') }
  })
}

onUnmounted(() => { alive = false; if (anim) anim.cancel() })
defineExpose({ tear, reset })
</script>

<style scoped>
.seal { position: relative; width: 190px; height: 260px; cursor: pointer; }
/* The clip line and the two insets have to add up to 100% or the seam shows. */
.seal-half {
  position: absolute; inset: 0; border-radius: 10px;
  background: linear-gradient(160deg, var(--pack-std-a), var(--pack-std-b));
  border: 1px solid var(--divider);
}
.seal-half.top { clip-path: inset(0 0 56% 0); }
.seal-half.bot { clip-path: inset(44% 0 0 0); }
.seal-in {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
}
.seal-top { font-weight: 800; letter-spacing: .06em; }
.seal-mid { color: var(--diamond); font-weight: 700; }
.seal-hint { font-size: 11px; }
.seal-rip {
  position: absolute; left: -6px; right: -6px; top: 44%;
  height: 3px; background: var(--cta); opacity: 0;
  box-shadow: 0 0 12px 3px var(--cta);
}
</style>
