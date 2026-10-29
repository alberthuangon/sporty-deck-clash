<template>
  <div class="to" :class="{ 'kickoff-starting': starting }">
    <div class="toss-content scroll">
    <header class="flow-heading"><span class="eyebrow">THE FINAL CALL</span><h1>Let the coin decide.</h1><p>Home or away. Your match starts here.</p></header>
    <div class="coin-stage" :class="{ landed: revealed }" aria-hidden="true">
      <div ref="coinEl" class="coin" :class="[{ done: revealed }, revealed ? side : '']" data-sfx="toss">
        <span class="coin-face front"><svg class="coin-engraving" viewBox="0 0 128 128"><text v-if="revealed" x="64" y="33" class="coin-brand">{{ GAME_NAME_UPPER }}</text><text x="64" y="86" class="coin-letter">{{ revealed ? (iAmHome ? 'H' : 'A') : '?' }}</text><text v-if="revealed" x="64" y="104" class="coin-label">{{ revealed ? (iAmHome ? 'HOME' : 'AWAY') : 'MATCHDAY' }}</text></svg></span>
        <span class="coin-face back"><svg class="coin-engraving" viewBox="0 0 128 128"><circle cx="64" cy="64" r="32" fill="none" stroke="currentColor" stroke-width="2"/><path d="m64 46 17 12-6 20H53l-6-20 17-12Zm0-14v14M34 54l13 4m34 0 13-4M45 90l8-12m22 0 8 12" fill="currentColor" fill-opacity=".75" stroke="currentColor" stroke-width="2"/></svg></span>
      </div>
      <div class="coin-shadow"></div>
    </div>
    <div class="t-status" role="status" aria-live="polite" :class="revealed ? side : ''">
      {{ revealed ? (iAmHome ? 'You are playing HOME' : 'You are playing AWAY') : 'Revealing…' }}
    </div>

    <!-- the landing is where two locked prices become one -->
    <div class="locks" v-if="quotes">
      <div class="lock home" :class="lockClass(true)">
        <span class="l-case">HOME</span>
        <span class="odds-cell home l-cell">{{ quotes.home.toFixed(2) }}</span>
      </div>
      <div class="lock away" :class="lockClass(false)">
        <span class="l-case">AWAY</span>
        <span class="odds-cell away l-cell">{{ quotes.away.toFixed(2) }}</span>
      </div>
    </div>

    <div v-if="revealed" class="t-detail muted">
      You are settled at <b class="green">{{ realised.toFixed(2) }}</b> —
      ₦{{ matchView.stake }} × {{ realised.toFixed(2) }} = ₦{{ payout.toLocaleString() }} if you win.
    </div>
    <div v-if="revealed" class="t-fine muted">
      Both prices were quoted and locked before you confirmed, and the
      assignment was already drawn — this only showed you which one applies.
    </div>

    </div>
    <div class="toss-actions">
    <button v-if="revealed" class="btn btn-cta" :disabled="starting" :aria-busy="starting" @click="kickOff">{{ starting ? 'Starting…' : 'Kick off' }}</button>
    </div>
  </div>
</template>

<script setup>
import { GAME_NAME_UPPER } from '../branding.js'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { runToss, matchView, branchQuotes } from '../game.js'

import { beginKickoff } from '../ui/kickoff.js'
import football from '../assets/kickoff-art/football.webp'

const starting = ref(false), coinEl = ref(null)
const revealed = ref(false)
const iAmHome = ref(false)
const quotes = computed(() => branchQuotes())
const realised = computed(() => (iAmHome.value ? quotes.value.home : quotes.value.away))
const payout = computed(() => Math.floor(matchView.stake * realised.value))

/* Only once the coin has landed. The assignment was drawn when the match was
   created and lives in ctx, never in matchView, precisely so nothing can
   paint it early — colouring the coin before it stops turning would be the
   screen answering its own question (src/game.js, PRD §3.9). */
const side = computed(() => (iAmHome.value ? 'home' : 'away'))

function lockClass (isHomeCell) {
  if (!revealed.value) return 'pending'
  return isHomeCell === iAmHome.value ? 'hit' : 'dead'
}

function kickOff () {
  if (!revealed.value || starting.value) return
  const rect = coinEl.value.getBoundingClientRect(), phone = coinEl.value.closest('.phone').getBoundingClientRect()
  const viewport = coinEl.value.closest('.toss-content').getBoundingClientRect()
  const visible = rect.top >= viewport.top && rect.bottom <= viewport.bottom
  const size = visible ? rect.width : 128
  const origin = visible ? { x: rect.left - phone.left, y: rect.top - phone.top, size } : { x: (phone.width - size) / 2, y: phone.height * .4 - size / 2, size }
  starting.value = beginKickoff(origin, iAmHome.value)
}

let t
onMounted(() => {
  const image = new Image(); image.src = football
  const res = runToss()
  iAmHome.value = res.aIsHome
  t = setTimeout(() => { revealed.value = true }, 1600)
})
onUnmounted(() => clearTimeout(t))
</script>

<style scoped>
.to.kickoff-starting .coin,.to.kickoff-starting .coin-shadow { opacity:0; }
.to {
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:16px;
  padding:26px 20px;
  background:radial-gradient(ellipse at 50% 27%,#79612c24,transparent 48%),linear-gradient(180deg,#0c1622c9,#10151e 62%),url('../assets/shop-art/stadium.webp') center top/auto 380px no-repeat,#10151e;
}
.flow-heading {
  text-align:center;
}
.eyebrow {
  font-size:10px;
  letter-spacing:.18em;
  color:#d5bf8e;
  font-weight:800;
}
h1 {
  font-size:28px;
  letter-spacing:-.045em;
  margin:8px 0;
}
p {
  font-size:12px;
  color:#acbaca;
  margin:0;
}
.coin-stage {
  position:relative;
  width:100%;
  height:218px;
  flex:none;
  display:flex;
  align-items:center;
  justify-content:center;
  perspective:850px;
}
.coin-stage::before {
  content:'';
  pointer-events:none;
  position:absolute;
  width:200px;
  height:200px;
  border:1px solid #e9cb7827;
  border-radius:50%;
  box-shadow:0 0 40px #e5ba4110;
}
.coin-stage::after {
  content:'';
  pointer-events:none;
  position:absolute;
  border-radius:50%;
  width:236px;
  height:236px;
  border-width:1px;
  border-style:dashed;
  border-color:#e9cb7815;
  animation:orbit 24s linear infinite;
}
.coin {
  position:relative;
  width:128px;
  height:128px;
  transform-style:preserve-3d;
  animation:coin-toss 1.6s cubic-bezier(.2,.5,.3,1) both;
  z-index:1;
}
.coin-face {
  position:absolute;
  inset:0;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:0;
  border-radius:50%;
  border:5px solid #e5c16b;
  background:radial-gradient(circle at 30% 20%,#fff2b8,#b98b37 52%,#ecd489 80%,#9c6b28);
  color:#594018;
  box-shadow:inset 0 0 0 2px #71501d,inset 0 0 0 6px #f9dd8e,inset 0 0 18px #6f451e88,0 12px 24px #0006;
  backface-visibility:hidden;
}
.coin-face::after {
  content:'';
  position:absolute;
  inset:10px;
  border-radius:50%;
  border:1px dashed #77531999;
  pointer-events:none;
}
.coin-face.back {
  transform:rotateY(180deg);
}
.coin.done {
  animation:coin-land .45s ease-out both;
}
.coin.done.home .front {
  border-color:#f3a098;
}
.coin.done.away .front {
  border-color:#9bc7fa;
}
.coin-shadow {
  position:absolute;
  bottom:12px;
  width:88px;
  height:10px;
  border-radius:50%;
  background:#0008;
  filter:blur(5px);
  animation:coin-shadow 1.6s ease both;
}
.coin-stage.landed::before {
  border-color:#f1d38a55;
}
.coin-stage.landed::after {
  animation:none;
  box-shadow:0 0 45px #e8bc5422;
}
.t-status {
  font-size:17px;
  font-weight:800;
  min-height:24px;
  text-align:center;
}
.t-status.home {
  color:var(--home-on);
}
.t-status.away {
  color:var(--away-on);
}
.locks {
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:12px;
  width:100%;
}
.lock {
  min-width:0;
  background:linear-gradient(135deg,#2b3946,#19222e);
  border:1px solid #677a8e66;
  border-radius:14px;
  padding:14px;
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:9px;
  transition:opacity .3s,border-color .3s;
}
.l-case {
  font-size:10px;
  font-weight:800;
  letter-spacing:.13em;
  color:#bac9d9;
}
.l-cell {
  width:100%;
  padding:7px 0;
  font-size:24px;
}
.lock.hit.home {
  border-color:var(--home);
  box-shadow:0 0 22px #e418271c;
}
.lock.hit.away {
  border-color:var(--away);
  box-shadow:0 0 22px #2f7be81c;
}
.lock.dead {
  opacity:.42;
}
.t-detail {
  font-size:13px;
  text-align:center;
  line-height:1.6;
  background:#ffffff06;
  border-radius:12px;
  padding:12px;
  width:100%;
}
.t-fine {
  font-size:10px;
  text-align:center;
  line-height:1.6;
  max-width:310px;
}
.to>.btn {
  margin-top:auto;
  width:100%;
  border-radius:12px;
}
@keyframes coin-toss {
  0% {
    transform:translateY(34px) rotateY(0) rotateZ(-12deg) scale(.85);
  }
  38% {
    transform:translateY(-32px) rotateY(900deg) rotateZ(9deg) scale(1.12);
  }
  76% {
    transform:translateY(-8px) rotateY(1620deg) rotateZ(-5deg) scale(1);
  }
  100% {
    transform:translateY(0) rotateY(1800deg) rotateZ(0);
  }
}
@keyframes coin-land {
  0% {
    transform:scale(1.06) rotateZ(-4deg);
  }
  55% {
    transform:scale(.98) rotateZ(2deg);
  }
  100% {
    transform:scale(1) rotateZ(0);
  }
}
@keyframes coin-shadow {
  0%,100% {
    transform:scaleX(1);
    opacity:.7;
  }
  40% {
    transform:scaleX(.6);
    opacity:.25;
  }
}
@keyframes orbit {
  to {
    transform:rotate(360deg);
  }
}
@media(prefers-reduced-motion:reduce) {
  .coin,.coin.done,.coin-stage::after,.coin-shadow {
    animation:none;
  }
}
@media(max-width:350px) {
  .to {
    padding:20px 14px;
    gap:13px;
  }
  .coin-stage {
    height:190px;
  }
  .coin-stage::before {
    width:176px;
    height:176px;
  }
  .coin-stage::after {
    content:'';
    pointer-events:none;
    position:absolute;
    border-radius:50%;
    width:202px;
    height:202px;
  }
}
.to {
  scrollbar-width:none;
}
.to::-webkit-scrollbar {
  display:none;
}
.coin-engraving {
  width:100%;
  height:100%;
  fill:currentColor;
  text-anchor:middle;
  font-family:inherit;
}
.coin-brand {
  font-size:5px;
  font-weight:900;
  letter-spacing:.1em;
}
.coin-letter {
  font-size:54px;
  font-weight:900;
}
.coin-label {
  font-size:8px;
  font-weight:900;
  letter-spacing:.17em;
}
.coin.done .back {
  visibility:hidden;
}
/* Keep kick-off reachable on a short phone while the details can scroll. */
.to { padding: 0; gap: 0; }
.toss-content { width: 100%; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 16px; min-height: 0; padding: 26px 20px; scrollbar-width: none; }
.toss-content::-webkit-scrollbar { display: none; }
.toss-content > * { flex-shrink: 0; }
.toss-actions { flex: none; height: 77px; padding: 14px 20px 18px; width: 100%; background: #141e2b; border-top: 1px solid #8c9aae22; }
.toss-actions .btn { border-radius: 12px; }
@media (max-width: 350px) {
  .to { padding: 0; }
  .toss-content { padding: 20px 14px; gap: 13px; }
  .toss-actions { padding-left: 14px; padding-right: 14px; }
}
</style>
