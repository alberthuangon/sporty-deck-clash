<template>
  <Teleport to=".phone">
    <div ref="dialogEl" class="vc" :class="{ running, closing }" role="dialog" aria-modal="true" aria-labelledby="victory-title" tabindex="-1" @click="finish" @keydown="onKey">
      <div class="victory-beams" aria-hidden="true"></div>
      <VictoryParticles :active="running" />
      <div class="victory-content">
        <span v-if="replay" class="victory-replay">REPLAY</span>
        <div class="victory-heading"><p>YOUR SQUAD WINS</p><h1 id="victory-title">VICTORY</h1></div>
        <div class="trophy-stage"><img ref="trophyEl" :src="trophyArt" width="640" height="800" alt="" aria-hidden="true" @load="start" @error="start" /></div>
        <button ref="continueEl" class="victory-continue" @click.stop="finish">Tap to continue</button>
      </div>
    </div>
  </Teleport>
</template>
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import VictoryParticles from './VictoryParticles.vue'
import trophyArt from '../assets/victory-art/trophy.webp'
defineProps({ replay: Boolean })
const emit = defineEmits(['done'])
const dialogEl = ref(null), trophyEl = ref(null), continueEl = ref(null)
const running = ref(false), closing = ref(false)
let mounted = false, timer, closeTimer, fallback
function start () { if (!mounted || running.value || closing.value) return; clearTimeout(fallback); running.value = true; timer = setTimeout(finish, 3400) }
function finish () { if (closing.value) return; clearTimeout(timer); clearTimeout(fallback); closing.value = true; closeTimer = setTimeout(() => emit('done'), 220) }
function onKey (event) { if (event.key === 'Tab') { event.preventDefault(); continueEl.value?.focus(); } else if (['Escape', 'Enter', ' '].includes(event.key)) { event.preventDefault(); finish() } }
onMounted(() => { mounted = true; dialogEl.value?.focus({ preventScroll: true }); fallback = setTimeout(start, 1200); if (trophyEl.value?.complete) start() })
onBeforeUnmount(() => { mounted = false; clearTimeout(timer); clearTimeout(closeTimer); clearTimeout(fallback) })
</script>
<style scoped>
.vc { position: absolute; inset: 0; z-index: 100; overflow: hidden; isolation: isolate; background: radial-gradient(ellipse at 50% 42%,#c18a2030,transparent 67%),linear-gradient(180deg,#06101c88,#06101c55 60%,#040b14d9),url('../assets/matchmaking-art/stadium.webp') center/cover,#06101b; outline: none; transition: opacity .22s ease; }
.vc::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle at 50% 45%,#fff2b866,transparent 65%); }
.vc.running::after { animation: victory-bloom 1.1s ease-out both; }
@keyframes victory-bloom { 0% { opacity: 0; } 30% { opacity: .55; } 100% { opacity: 0; } }
.vc.closing { opacity: 0; pointer-events: none; }
.victory-beams { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.victory-beams::before,.victory-beams::after { content: ''; position: absolute; inset: -15% -30%; background: repeating-linear-gradient(113deg,transparent 0 18%,#ffe29e19 19%,#fff0c72b 19.4%,transparent 21% 34%); opacity: .65; transform: rotate(-4deg); }
.victory-beams::after { background: repeating-linear-gradient(67deg,transparent 0 20%,#ffe29e14 22%,#fff0c72b 22.5%,transparent 24% 37%); }
.running .victory-beams::before { animation: beam-sweep 4s ease-in-out infinite alternate; }.running .victory-beams::after { animation: beam-sweep 3.2s ease-in-out infinite alternate-reverse; transform: scaleX(-1) rotate(6deg); opacity: .35; }
.victory-content { position: absolute; inset: 0; z-index: auto; display: flex; flex-direction: column; align-items: center; padding: 80px 20px 28px; gap: 22px; }
.victory-heading { position: relative; z-index: 3; width: 100%; flex: none; text-align: center; opacity: 0; }.victory-heading p { margin: 0 0 9px; color: #fff0cd; font-size: 12px; font-weight: 700; letter-spacing: .22em; }.victory-heading h1 { margin: 0; font-size: clamp(63px, 21vw, 90px); line-height: 1.05; font-weight: 900; letter-spacing: -.055em; color: #ffdf83; background: linear-gradient(160deg,#fff7d5,#f5d272 35%,#d69f37 61%,#fff0b4 76%,#b97e23); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 3px 1px #704215) drop-shadow(0 0 16px #ffe79b30); }
.trophy-stage { position: relative; z-index: 1; width: 100%; flex: 1; min-height: 0; display: flex; justify-content: center; align-items: flex-start; opacity: 0; }.trophy-stage img { display: block; height: 100%; max-height: 510px; max-width: 100%; width: auto; object-fit: contain; filter: drop-shadow(0 10px 25px #0008); }
.victory-continue { position: relative; z-index: 3; flex: none; min-height: 44px; min-width: 180px; padding: 10px 18px; color: #f5e5c7; font-size: 12px; letter-spacing: .13em; border-radius: 8px; border: 1px solid transparent; }.victory-continue:focus-visible { outline: 2px solid #ffe3a0; outline-offset: 3px; }
.victory-replay { z-index: 3; position: absolute; top: 20px; font-size: 10px; color: #e9cf92; letter-spacing: .2em; }
.running .victory-heading { animation: victory-title .65s cubic-bezier(.16,.8,.25,1) .1s both; }.running .trophy-stage { animation: trophy-reveal .8s cubic-bezier(.16,.8,.25,1) .15s both; }.running .trophy-stage img { animation: trophy-float 2.4s ease-in-out .95s infinite alternate; }
@keyframes victory-title { from { opacity: 0; transform: translateY(12px) scale(.93); } to { opacity: 1; transform: none; } }@keyframes trophy-reveal { from { opacity: 0; transform: translateY(24px) scale(.92); } to { opacity: 1; transform: none; } }@keyframes trophy-float { from { transform: translateY(0) rotate(-1deg); } to { transform: translateY(-5px) rotate(1deg); } }@keyframes beam-sweep { from { transform: translateX(-4%) rotate(-5deg); opacity: .4; } to { transform: translateX(6%) rotate(5deg); opacity: .85; } }
@media(max-height:750px) { .victory-content { padding-top: 64px; gap: 16px; }.victory-heading h1 { font-size: clamp(63px, 19vw, 76px); } }
@media(max-width:350px) { .victory-content { padding-left: 15px; padding-right: 15px; }.victory-heading h1 { font-size: 63px; }.victory-heading p { font-size: 10px; } }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { animation: none !important; }.victory-heading,.trophy-stage { opacity: 1; } }
</style>
