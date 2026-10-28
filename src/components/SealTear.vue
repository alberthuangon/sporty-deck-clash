<template>
  <div class="seal-wrap">
    <div class="seal" ref="sealEl" @dragstart.prevent role="button" tabindex="0" :aria-label="`Tear open ${title}`" @pointerdown="packDown" @pointermove="packMove" @pointerup="packUp" @pointercancel="packCancel" @keydown.enter.prevent="tear" @keydown.space.prevent="tear">
      <div ref="stackEl" class="seal-stack" aria-hidden="true"><i></i><div><PackCrest /></div></div>
      <div class="seal-half top" ref="tearA"><PackArtwork :tier="tier" /></div>
      <div class="seal-half bot" ref="tearB"><PackArtwork :tier="tier" /></div>
      <div class="seal-rip" ref="ripEl"></div>
    </div>
    <p class="seal-caption">{{ title }} <span>· ◆ {{ price }}</span></p>
    <p class="seal-hint">{{ hint }}</p>
  </div>
</template>

<script setup>
/* Tap or drag the upper seam to open. The two halves share the real Shop
   artwork; a cancelled gesture springs back without granting/revealing cards. */
import { ref, onUnmounted } from 'vue'
import gsap from 'gsap'
import { uiPlay, UI_TIME } from '../ui/motion.js'

import PackArtwork from './PackArtwork.vue'
import PackCrest from './PackCrest.vue'

defineProps({
  title: { type: String, default: 'Pack' },
  price: { type: [Number, String], default: 0 },
  hint: { type: String, default: 'tap to tear' },
  tier: { type: String, default: 'standard' }     // standard | gold
})
const emit = defineEmits(['torn'])

const sealEl = ref(null)
const tearA = ref(null)
const tearB = ref(null)
const ripEl = ref(null)
const stackEl = ref(null)
let anim = null
let alive = true
let drag = null
let returning = null
function packDown(e) {
  if (e.button > 0 || anim) return
  const r=sealEl.value.getBoundingClientRect()
  drag={ id:e.pointerId, x:e.clientX, y:e.clientY, width:r.width, zone:e.clientY-r.top < r.height*.33, moved:false }
  returning?.kill()
  try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* The pointer may already have ended. */ }
}
function packMove(e) {
  if(!drag || drag.id!==e.pointerId) return
  const dx=e.clientX-drag.x
  if(Math.abs(dx)>6) drag.moved=true
  if(!drag.zone || !drag.moved) return
  const p=Math.max(0,Math.min(1,dx/(drag.width*.65)))
  gsap.set(tearA.value,{x:p*12,y:-p*9,rotation:p*5,transformOrigin:'100% 15%'})
  gsap.set(ripEl.value,{opacity:p,scaleX:p,transformOrigin:'left center'})
  if(p>=.7) { drag=null; tear() }
}
function packUp(e) {
  if(anim) { if(drag) drag=null; return }
  if(!drag || drag.id!==e.pointerId) return
  const d=drag; drag=null
  if(!d.moved) tear(); else packCancel()
}
function packCancel() { drag=null; returning=gsap.to([tearA.value,ripEl.value],{x:0,y:0,rotation:0,scaleX:1,opacity:(i)=>i===0?1:0,duration:.22,ease:'power2.out'}) }


function reset () {
  drag=null
  returning?.kill()
  if (anim) { anim.cancel(); anim = null }
  gsap.set([sealEl.value, tearA.value, tearB.value, ripEl.value, stackEl.value].filter(Boolean), { clearProps: 'all' })
}

/* A second tap skips rather than starting another. That matters more here
   than anywhere else: a pack is opened dozens of times in a session, and the
   second one is already too slow. */
function tear () {
  if (anim && !anim.record.done) { anim.skip(); return }
  if (anim) return
  returning?.kill()
  drag=null
  const d = UI_TIME.tear
  anim = uiPlay('tear', tl => {
    tl.fromTo(stackEl.value,{opacity:0,y:25,scale:.78},{opacity:1,y:-28,scale:.9,duration:d*.7,ease:'power2.out'},d*.3)
    tl.fromTo(ripEl.value, { opacity: 0, scaleX: 0.2 },
      { opacity: 1, scaleX: 1, duration: d * 0.18, ease: 'power2.out' }, 0)
    tl.to(sealEl.value, { scale: 0.96, duration: d * 0.12, ease: 'power2.out' }, 0)
    tl.to(sealEl.value, { scale: 1, duration: d * 0.18, ease: 'power2.inOut' }, d * 0.12)
    /* The upper seam flies off while the body drops and the card stack rises.
       All three finish on the tear dial; the first card then flips separately. */
    tl.to(tearA.value, { y: -85, x: 60, rotate: 28, scale: 0.94, duration: d * 0.84, ease: 'power1.in' }, d * 0.16)
    tl.to(tearB.value, { y: 84, x: -8, rotate: -5, scale: 0.94, duration: d * 0.84, ease: 'power1.in' }, d * 0.16)
    tl.to([tearA.value, tearB.value], { opacity: 0, duration: d * 0.5, ease: 'power1.in' }, d * 0.5)
    tl.to(ripEl.value, { opacity: 0, scaleY: 3.4, duration: d * 0.4, ease: 'power2.out' }, d * 0.4)
  }, {
    interruptible: true,
    onEnd: () => { if (alive) emit('torn') }
  })
}

onUnmounted(() => { alive = false; returning?.kill(); if (anim) anim.cancel() })
defineExpose({ tear, reset })
</script>

<style scoped>
.seal-wrap { display:flex; flex-direction:column; align-items:center; gap:6px; }
.seal { position:relative; width:190px; height:260px; cursor:pointer; touch-action:none; user-select:none; }
.seal:focus-visible { outline:2px solid var(--cta); outline-offset:3px; border-radius:8px; }
/* Both layers contain the identical complete asset; their clips meet at the tear line. */
.seal-half { position:absolute; inset:0; z-index:2; }
.seal-half.top { z-index:3; }
.seal-stack { position:absolute; inset:15px 12px; opacity:0; }
.seal-stack > div,.seal-stack > i { position:absolute; inset:0; display:grid; place-items:center; border:1px solid #718db2; border-radius:10px; background:repeating-linear-gradient(135deg,transparent 0 9px,#adc7ee08 9px 10px),linear-gradient(140deg,#2a4668,#0c1727); box-shadow:inset 0 0 0 6px #142438; }
.seal-stack > i { transform:translate(6px,5px) rotate(3deg); }
.seal-stack .pack-crest { width:60px; height:60px; --pack-ink:#b4cbe7; }
.seal-half.top { clip-path:inset(0 0 85% 0); }
.seal-half.bot { clip-path:inset(15% 0 0 0); }
.seal-caption { margin:0; color:#e0e7f1; font-size:12px; font-weight:600; }
.seal-caption span { color:var(--diamond); font-size:11px; }
.seal-hint { margin:0; color:#b8c5d7; font-size:11px; }
.seal-rip {
  position: absolute; left: -6px; right: -6px; top: 15%;
  height: 3px; opacity: 0;
  /* white-gold in the middle, mint at the ends — something inside the bag
     catching the light. Static paint: the timeline only touches opacity,
     scaleX and scaleY, so no beat changes. */
  background: linear-gradient(90deg, transparent, var(--cta) 18%, #FFF6D8 50%, var(--cta) 82%, transparent);
  box-shadow: 0 0 14px 4px rgba(51,234,106,.55), 0 0 30px 10px rgba(255,214,120,.22);
}
</style>
