<template>
  <div ref="rootEl" class="ko" :class="{ 'ko-reduced': reduced }" :data-phase="phase" role="button" tabindex="0" aria-label="Starting match. Skip kick-off animation" @click="finish" @keydown.enter.prevent="finish" @keydown.space.prevent="finish" @keydown.esc.prevent="finish">
    <div class="ko-shade" ref="shadeEl"></div>
    <div v-if="!reduced" class="ko-stage" aria-hidden="true">
      <div class="ko-glow" ref="glowEl"></div>
      <div class="ko-ring" ref="ringEl"></div>
      <div class="ko-token" ref="tokenEl">
        <div class="ko-coin" ref="coinEl" :class="kickoff.home ? 'home' : 'away'"><svg viewBox="0 0 128 128"><text x="64" y="33" class="ko-brand">{{ GAME_NAME_UPPER }}</text><text x="64" y="86" class="ko-letter">{{ kickoff.home ? 'H' : 'A' }}</text><text x="64" y="104" class="ko-label">{{ kickoff.home ? 'HOME' : 'AWAY' }}</text></svg></div>
        <img ref="ballEl" class="ko-ball" :src="football" width="640" height="640" alt="" aria-hidden="true" decoding="async" />
      </div>
    </div>
    <div class="ko-cover" ref="coverEl"></div>
  </div>
</template>
<script setup>
import { GAME_NAME_UPPER } from '../branding.js'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import gsap from 'gsap'
import { kickoff } from '../ui/kickoff.js'
import { reduced } from '../ui/motion.js'
import { store, go } from '../store.js'
import football from '../assets/kickoff-art/football.webp'
const rootEl = ref(null), shadeEl = ref(null), glowEl = ref(null), ringEl = ref(null), tokenEl = ref(null), coinEl = ref(null), ballEl = ref(null), coverEl = ref(null)
const phase = ref('coin')
let timeline, observer, routed = false, ending = false
const inertSiblings = new Map()
function lockBackground () {
  for (const el of rootEl.value.parentElement.children) {
    if (el === rootEl.value || inertSiblings.has(el)) continue
    inertSiblings.set(el, el.inert); el.inert = true
  }
}
function route () { if (!routed) { routed = true; phase.value = 'handoff'; go('match') } }
function finish () {
  if (ending) return
  ending = true; timeline?.kill(); route(); kickoff.active = false
}
onMounted(() => {
  const root = rootEl.value, host = root.parentElement
  lockBackground(); observer = new MutationObserver(lockBackground); observer.observe(host, { childList: true })
  root.focus({ preventScroll: true })
  timeline = gsap.timeline({ data: 'kickoff', onComplete: finish })
  if (reduced.value) {
    timeline.to(coverEl.value, { opacity: 1, duration: .08 })
      .call(route, null, .08).to(coverEl.value, { opacity: 0, duration: .10 }, .30)
    return
  }
  const { width, height } = host.getBoundingClientRect()
  const origin = kickoff.origin, size = origin.size
  const cx = width / 2, cy = height * .45
  gsap.set(tokenEl.value, { x: origin.x, y: origin.y, width: size, height: size })
  gsap.set([glowEl.value, ringEl.value], { left: origin.x + size / 2, top: origin.y + size / 2 })
  timeline.to(shadeEl.value, { opacity: .6, duration: .2 }, 0)
    .to(coinEl.value, { rotationY: 720, rotationZ: 15, scale: 1.08, duration: .28, ease: 'power2.in' }, 0)
    .to(coinEl.value, { opacity: 0, duration: .13 }, .16)
    .fromTo(ballEl.value, { opacity: 0, scale: .9, rotation: -70 }, { opacity: 1, scale: 1.12, rotation: 0, duration: .19, ease: 'power2.out' }, .16)
    .call(() => { phase.value = 'football' }, null, .25)
    .to(tokenEl.value, { x: cx - size / 2, y: cy - size / 2, scale: Math.hypot(width, height) / size * 1.45, rotation: 100, duration: .36, ease: 'power3.in' }, .25)
    .to(glowEl.value, { opacity: .45, scale: 3.5, duration: .3, ease: 'power2.in' }, .24)
    .fromTo(ringEl.value, { opacity: .65, scale: .65 }, { opacity: 0, scale: 3.7, duration: .38, ease: 'power2.out' }, .18)
    .to(coverEl.value, { opacity: 1, duration: .09 }, .52)
    .call(route, null, .61)
    .to(coverEl.value, { opacity: 0, duration: .13, ease: 'power1.out' }, .85)
    .to([shadeEl.value, tokenEl.value, glowEl.value], { opacity: 0, duration: .01 }, .62)
})
watch(reduced, value => { if (value && timeline) finish() })
watch(() => store.currentScreen, screen => { if (!['toss', 'match'].includes(screen)) { ending = true; timeline?.kill(); kickoff.active = false } })
onBeforeUnmount(() => {
  ending = true; timeline?.kill(); observer?.disconnect()
  inertSiblings.forEach((was, el) => { el.inert = was })
  if (routed && store.currentScreen === 'match') {
    const screen = rootEl.value.parentElement.querySelector('[data-screen="match"]')
    if (screen) { screen.setAttribute('tabindex', '-1'); screen.focus({ preventScroll: true }); screen.removeAttribute('tabindex') }
  }
})
</script>
<style scoped>
.ko { position:absolute; inset:0; z-index:90; overflow:hidden; outline:none; cursor:pointer; }
.ko-shade { position:absolute; inset:0; z-index:90; background:#07121f; opacity:0; pointer-events:none; }
.ko-stage { position:absolute; inset:0; z-index:91; perspective:1000px; pointer-events:none; }
.ko-token { position:absolute; left:0; top:0; transform-origin:50% 50%; will-change:transform; }
.ko-coin { position:absolute; inset:0; border-radius:50%; border:5px solid #e5c16b; background:radial-gradient(circle at 30% 20%,#fff2b8,#b98b37 52%,#ecd489 80%,#9c6b28); color:#594018; box-shadow:inset 0 0 0 2px #71501d,inset 0 0 0 6px #f9dd8e,inset 0 0 18px #6f451e88,0 12px 24px #0006; }
.ko-coin::after { content:''; position:absolute; inset:10px; border:1px dashed #77531999; border-radius:50%; }.ko-coin.home { border-color:#f3a098; }.ko-coin.away { border-color:#9bc7fa; }
.ko-coin svg { display:block; width:100%; height:100%; fill:currentColor; text-anchor:middle; font-family:inherit; }.ko-brand { font-size:5px; font-weight:900; letter-spacing:.1em; }.ko-letter { font-size:54px; font-weight:900; }.ko-label { font-size:8px; font-weight:900; letter-spacing:.17em; }
.ko-ball { position:absolute; inset:0; display:block; width:100%; height:100%; object-fit:contain; opacity:0; filter:drop-shadow(0 8px 14px #0006); }
.ko-glow { position:absolute; width:240px; height:240px; margin:-120px 0 0 -120px; background:radial-gradient(circle,#ffe9aa99,#ffe5a624 40%,transparent 70%); border-radius:50%; opacity:0; }
.ko-ring { position:absolute; width:170px; height:170px; margin:-85px 0 0 -85px; border:1px solid #ffe6a477; border-radius:50%; opacity:0; }
.ko-cover { position:absolute; inset:0; z-index:92; background:radial-gradient(ellipse at 50% 45%,#243647,#0b1724 70%); opacity:0; pointer-events:none; }
.ko-reduced .ko-cover { background:#0b1724; }
</style>
