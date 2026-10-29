<template>
  <section ref="dialogEl" class="dr" :class="[draw.won ? 'won' : 'lost', { none: !draw.myTickets, motion: moving }]" role="dialog" aria-modal="true" aria-labelledby="draw-title" aria-describedby="draw-description" tabindex="-1" @keydown="onKey">
    <div class="dr-beams" aria-hidden="true"></div>
    <VictoryParticles v-if="draw.won && moving" active class="draw-particles" />
    <div ref="scrollEl" class="dr-scroll scroll">
      <div class="dr-in">
        <header class="dr-heading">
          <span class="dr-kicker"><Icon name="ticket" :size="14" /> SEASON {{ draw.season }} · DRAW RESULT</span>
          <h1 id="draw-title" class="dr-title">{{ draw.won ? 'JACKPOT!' : 'DRAW COMPLETE' }}</h1>
          <p id="draw-description">{{ draw.won ? 'You won the grand prize.' : draw.myTickets ? 'Your tickets weren’t selected this season.' : 'You had no tickets in this draw.' }}</p>
        </header>

        <div class="dr-art" aria-hidden="true">
          <img class="jackpot-award" :src="awardArt" width="640" height="640" alt="" decoding="async" fetchpriority="high" />
          <div class="draw-archive"><div class="archive-insignia"><Icon name="ticket" :size="60" /></div><span class="archive-label">SEASON {{ draw.season }} · ARCHIVED</span></div>
        </div>

        <div class="dr-reward">
          <div class="dr-prize" role="group" :aria-label="draw.won ? `Grand prize: ₦${draw.prize.toLocaleString()}` : 'No prize this season'">
            <CountUp v-if="draw.won" :key="draw.season" :value="draw.prize" :from="Math.floor(draw.prize * .95)" :animate="animate" prefix="₦" aria-hidden="true" />
            <span v-else class="no-prize">No prize this season</span>
          </div>
          <p class="dr-credit"><span class="credit-check" aria-hidden="true">✓</span>{{ draw.won ? 'Added to your balance' : 'Your draw details are saved below' }}</p>
        </div>

        <section class="dr-rows" aria-label="Recorded draw details">
          <div class="winning-ticket">
            <span class="ticket-mark" aria-hidden="true"><Icon name="ticket" :size="24" /></span>
            <div><h2>WINNING TICKET</h2><span class="ticket-caption">Season {{ draw.season }} draw</span></div>
            <b class="winning-number">#{{ draw.winningTicket.toLocaleString() }}</b>
          </div>
          <dl class="draw-ledger">
            <div class="dr-row"><dt>Your tickets</dt><dd>{{ draw.myTickets.toLocaleString() }}<small>of {{ draw.totalTickets.toLocaleString() }}</small></dd></div>
            <div class="dr-row odds"><dt>Grand prize odds</dt><dd>{{ odds === null ? '—' : `1 in ${odds.toLocaleString()}` }}<small>{{ odds === null ? 'No tickets entered' : 'At the time of the draw' }}</small></dd></div>
          </dl>
        </section>
        <p class="dr-record-note"><Icon name="history" :size="13" />A saved result. Reopening won’t run another draw.</p>
      </div>
    </div>
    <footer class="dr-footer">
      <div class="dr-next"><span class="season-marker" aria-hidden="true"><Icon name="ticket" :size="20" /></span><div><b>Season {{ draw.season + 1 }} is open</b><span class="next-caption">{{ waiting }} tickets on the reward road</span></div></div>
      <button ref="closeEl" class="btn dr-go" @click="dismiss">Close<span class="close-arrow" aria-hidden="true">›</span></button>
    </footer>
  </section>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import CountUp from '../components/CountUp.vue'
import VictoryParticles from '../components/VictoryParticles.vue'
import Icon from '../components/Icon.vue'
import awardArt from '../assets/jackpot-art/award.webp'
import { store, ticketsWaiting } from '../game.js'
import { reduced } from '../ui/motion.js'
const props = defineProps({ animate: { type: Boolean, default: true } })
const draw = computed(() => store.jackpot.lastDraw)
const odds = computed(() => draw.value.myTickets ? Math.round(draw.value.totalTickets / draw.value.myTickets) : null)
const waiting = computed(() => ticketsWaiting())
const moving = computed(() => props.animate && !reduced.value)
const dialogEl = ref(null), closeEl = ref(null), scrollEl = ref(null)
let previousFocus, siblingObserver
const inertSiblings = new Map()
function lockBackground () {
  for (const el of dialogEl.value.parentElement.children) {
    if (el === dialogEl.value || inertSiblings.has(el)) continue
    inertSiblings.set(el, el.inert); el.inert = true
  }
}
function dismiss () { store.flags.seenDraw = draw.value.season; store.overlay = null }
function onKey (event) {
  if (event.key === 'Escape') { event.preventDefault(); dismiss() }
  else if (event.key === 'Tab') { event.preventDefault(); closeEl.value?.focus() }
  else if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
    event.preventDefault()
    const el = scrollEl.value
    if (event.key === 'Home') el.scrollTop = 0
    else if (event.key === 'End') el.scrollTop = el.scrollHeight
    else el.scrollTop += (event.key.endsWith('Up') ? -1 : 1) * (event.key.startsWith('Page') ? el.clientHeight * .85 : 48)
  }
}
onMounted(() => {
  previousFocus = document.activeElement
  // A full-phone result blocks both pointer and keyboard access to the app.
  lockBackground()
  // App screen transitions can insert their new screen after the modal mounts.
  siblingObserver = new MutationObserver(lockBackground)
  siblingObserver.observe(dialogEl.value.parentElement, { childList: true })
  dialogEl.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => {
  siblingObserver?.disconnect()
  inertSiblings.forEach((was, el) => { el.inert = was })
  if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus?.({ preventScroll: true })
})
</script>

<style scoped>
.dr { position:absolute; inset:0; z-index:60; display:flex; flex-direction:column; min-height:0; overflow:hidden; isolation:isolate; outline:none; background:linear-gradient(180deg,#07111dcc,#07121c70 45%,#07121dee 80%),url('../assets/matchmaking-art/stadium.webp') center/cover,#07121e; }
.dr.won { background:radial-gradient(ellipse at 50% 26%,#aa761b24,transparent 65%),linear-gradient(180deg,#0b1520ab,#0a15215c 47%,#07121eef 82%),url('../assets/matchmaking-art/stadium.webp') center/cover,#07121e; }
.dr-beams { position:absolute; inset:0; z-index:60; overflow:hidden; pointer-events:none; opacity:0; }.won .dr-beams { opacity:1; }
.dr-beams::before,.dr-beams::after { content:''; position:absolute; inset:-20% -40%; background:repeating-linear-gradient(115deg,transparent 0 17%,#f7d48913 18%,#fff1ce29 18.4%,transparent 21% 38%); transform:rotate(-5deg); }.dr-beams::after { background:repeating-linear-gradient(65deg,transparent 0 23%,#ffdd9912 25%,#fff0c725 25.3%,transparent 28% 43%); opacity:.6; }
.motion.won .dr-beams::before { animation:jackpot-beams 5s ease-in-out infinite alternate; }.motion.won .dr-beams::after { animation:jackpot-beams 6.5s ease-in-out infinite alternate-reverse; }
.draw-particles { z-index:61; opacity:.8; }
.dr-scroll { z-index:62; position:relative; min-height:0; scrollbar-width:none; }.dr-scroll::-webkit-scrollbar { display:none; }.dr-in { display:flex; flex-direction:column; align-items:stretch; max-width:430px; width:100%; margin:auto; padding:32px 22px 22px; }
.dr-heading { text-align:center; }.dr-kicker { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:29px; padding:5px 12px; border:1px solid #96adbf60; border-radius:999px; color:#c6d6e4; background:#152535a6; font-size:9px; font-weight:750; letter-spacing:.12em; }.won .dr-kicker { border-color:#cba76088; color:#f5d98c; background:#3b302260; }
.dr-title { display:flex; justify-content:center; align-items:center; min-height:52px; margin-top:13px; font-size:30px; line-height:1.1; font-weight:900; letter-spacing:-.035em; color:#e3ebf4; }.won .dr-title { font-size:44px; color:#ffe69d; text-shadow:0 2px 0 #80521b,0 0 30px #eab23c3d; }.dr-heading p { min-height:17px; margin:5px 0 0; color:#cbd7e2; font-size:12px; line-height:17px; }
.dr-art { position:relative; height:230px; flex:none; margin:9px 0 2px; }.jackpot-award { position:absolute; inset:0; display:block; width:100%; height:100%; object-fit:contain; opacity:0; filter:drop-shadow(0 10px 14px #0008); }.won .jackpot-award { opacity:1; }.draw-archive { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; opacity:1; color:#adc1d1; }.won .draw-archive { opacity:0; }.archive-insignia { width:116px; height:116px; display:flex; justify-content:center; align-items:center; border-radius:30px; border:1px solid #9bb4c766; background:linear-gradient(140deg,#3a51646b,#162737c9); box-shadow:inset 0 1px 0 #e4f0ff22,0 16px 30px #0003; transform:rotate(-8deg); color:#c5d5e2; }.draw-archive > span { font-size:9px; font-weight:700; letter-spacing:.2em; }
.dr-reward { text-align:center; margin:0 0 22px; }.dr-prize { display:flex; align-items:center; justify-content:center; min-height:54px; font-size:clamp(27px,9.3vw,42px); font-weight:900; line-height:1.2; letter-spacing:-.04em; color:#ffe19a; font-variant-numeric:tabular-nums; }.dr-prize :deep(.count-up) { display:block; background:linear-gradient(110deg,#e0af51 15%,#fff1c2 35%,#e8b65b 55%,#fff5d1 70%,#e0af51 85%); background-size:220% 100%; background-clip:text; -webkit-background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 2px 1px #50340f); }.no-prize { color:#dce6ee; font-size:20px; letter-spacing:-.02em; font-weight:700; }.dr-credit { display:flex; justify-content:center; align-items:center; gap:5px; min-height:18px; color:#aebfcd; font-size:10px; margin:4px 0 0; }.won .dr-credit { color:#e5cf99; }.credit-check { color:#89e7b0; font-size:13px; opacity:0; }.won .credit-check { opacity:1; }
.dr-rows { flex:none; position:relative; overflow:hidden; padding:0 15px; border-radius:15px; border:1px solid #91a9bd66; background:linear-gradient(135deg,#243746e8,#132433ed); box-shadow:inset 0 1px 0 #fff1,0 15px 30px #0002; }.won .dr-rows { border-color:#c9a76099; background:linear-gradient(130deg,#373527df,#1d2b35f2); }
.winning-ticket { display:flex; align-items:center; gap:10px; min-height:78px; padding:13px 0; border-bottom:1px dashed #a8bdcd5c; position:relative; }.ticket-mark { display:flex; align-items:center; justify-content:center; width:37px; height:37px; flex:none; border-radius:10px; background:#b8cdde0d; border:1px solid #8ca6bb55; color:#ccdae5; }.won .ticket-mark { color:#f3cf7d; border-color:#c4a05f88; background:#d5a84f15; }.winning-ticket > div { flex:1; min-width:0; }.winning-ticket h2 { font-size:9px; letter-spacing:.12em; color:#dbe6ef; font-weight:750; }.ticket-caption { display:block; margin-top:5px; font-size:9px; color:#b3c5d5; }.winning-number { font-size:25px; letter-spacing:.01em; font-weight:850; color:#eef5fc; font-variant-numeric:tabular-nums; }.won .winning-number { color:#ffe2a2; }
.draw-ledger { display:grid; grid-template-columns:1fr 1fr; margin:0; padding:16px 0 17px; }.dr-row { min-width:0; }.dr-row + .dr-row { padding-left:14px; border-left:1px solid #a9bfce30; }.dr-row dt { color:#c0cfdc; font-size:10px; }.dr-row dd { margin:6px 0 0; font-size:16px; line-height:1.2; font-weight:800; color:#edf4fa; font-variant-numeric:tabular-nums; }.dr-row small { display:block; margin-top:5px; font-size:9px; font-weight:400; color:#a8bdce; }.dr-record-note { display:flex; align-items:center; justify-content:center; gap:5px; color:#9eb3c5; font-size:9px; margin:13px 0 0; text-align:center; line-height:1.5; }
.dr-footer { flex:none; position:relative; z-index:63; padding:16px 22px 22px; background:linear-gradient(#0b1925ee,#0b1724); border-top:1px solid #a5b9ca2e; }.dr-next { display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:15px; }.season-marker { display:flex; align-items:center; justify-content:center; width:37px; height:37px; border:1px solid #8ba4b54d; border-radius:10px; color:#c8d8e5; background:#c5d7e80a; }.dr-next > div { display:flex; flex-direction:column; gap:4px; }.dr-next b { color:#e5eef5; font-size:12px; font-weight:700; }.dr-next span:not(.season-marker) { color:#aec2d4; font-size:10px; }.dr-go { position:relative; min-height:48px; height:48px; background:linear-gradient(135deg,#334b5e,#243b4c); color:#edf5fb; border:1px solid #b2c7d566; border-radius:12px; font-size:16px; font-weight:800; }.won .dr-go { background:linear-gradient(110deg,#ffedb2,#e6bd65); color:#30200c; border-color:#ffe7ab; box-shadow:0 4px 20px #c391231e; }.dr-go > span { position:absolute; right:18px; font-size:26px; font-weight:400; }.dr-go:focus-visible { outline:2px solid #f5df9f; outline-offset:4px; }
.motion.won .jackpot-award { animation:award-reveal .7s cubic-bezier(.16,.8,.25,1) both,award-float 3.2s ease-in-out .75s infinite alternate; }.motion.won .dr-title { animation:jackpot-title .55s cubic-bezier(.16,.8,.25,1) both; }.motion.won .dr-prize :deep(.count-up) { animation:prize-shimmer 4s ease-in-out infinite; }.motion .dr-rows { animation:ledger-arrive .45s ease-out both; }
@keyframes jackpot-beams { from { transform:translateX(-6%) rotate(-7deg); opacity:.35; } to { transform:translateX(8%) rotate(7deg); opacity:.85; } }@keyframes award-reveal { from { opacity:0; transform:translateY(16px) scale(.85); } to { opacity:1; transform:none; } }@keyframes award-float { from { transform:translateY(0) rotate(-1deg); } to { transform:translateY(-6px) rotate(1deg); } }@keyframes jackpot-title { from { opacity:0; transform:translateY(10px) scale(.94); } to { opacity:1; transform:none; } }@keyframes prize-shimmer { from { background-position:110% 0; } to { background-position:-110% 0; } }@keyframes ledger-arrive { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
@media(max-height:790px) { .dr-in { padding-top:23px; }.dr-art { height:182px; margin-top:6px; }.dr-reward { margin-bottom:17px; }.dr-footer { padding-top:12px; padding-bottom:16px; }.dr-next { margin-bottom:11px; } }
@media(max-width:350px) { .dr-in { padding-left:15px; padding-right:15px; }.dr-kicker { font-size:8px; letter-spacing:.1em; }.dr-title { font-size:26px; }.won .dr-title { font-size:39px; }.dr-heading p { font-size:10px; }.dr-art { height:165px; }.dr-rows { padding:0 12px; }.winning-ticket { gap:8px; }.winning-ticket h2 { font-size:8px; letter-spacing:.08em; }.winning-number { font-size:21px; }.ticket-mark { width:31px; height:35px; }.dr-row dt { font-size:9px; }.dr-row dd { font-size:14px; }.dr-row small { font-size:8px; }.dr-record-note { font-size:8px; }.dr-footer { padding-left:15px; padding-right:15px; } }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important; } }
</style>
