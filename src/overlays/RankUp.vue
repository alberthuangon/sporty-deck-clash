<template>
  <section ref="dialogEl" class="ru" :class="'ru-tier-' + tierIndex" :style="{ '--promotion-accent': tierColour }" role="dialog" aria-modal="true" aria-labelledby="promotion-title" aria-describedby="promotion-description" tabindex="-1" @keydown="onKey">
    <div class="ru-atmosphere" aria-hidden="true"></div>
    <VictoryParticles active class="ru-particles" />
    <div class="ru-in">
      <header class="ru-heading">
        <span class="ru-kicker"><span aria-hidden="true">↑</span> RANK UP</span>
        <p>You earned your place.</p>
      </header>

      <div class="ru-hero">
        <div ref="crestEl" class="ru-emblem">
          <div class="ru-emblem-light" aria-hidden="true"></div>
          <RankCrest :tier="tierIndex" :sub="subtier" hero />
          <div ref="shineEl" class="ru-shine" aria-hidden="true"></div>
        </div>
        <span class="ru-league">{{ newLeague ? 'NEW LEAGUE UNLOCKED' : 'NEW TIER REACHED' }}</span>
        <h1 id="promotion-title" class="ru-tier">{{ view.label }}</h1>
        <div class="ru-path" aria-label="Rank promotion"><span>{{ previousLabel }}</span><span class="ru-path-arrow" aria-hidden="true">→</span><strong>{{ view.label }}</strong></div>
      </div>

      <section ref="rewardEl" class="ru-rewards" aria-labelledby="promotion-rewards-title">
        <header><h2 id="promotion-rewards-title">Milestone rewards</h2><span class="ru-received"><span aria-hidden="true">✓</span> RECEIVED</span></header>
        <div v-if="view.reward.tickets" ref="ticketChip" class="rw ru-ticket">
          <img :src="ticketArt" width="160" height="160" alt="" class="ru-ticket-art">
          <div><strong>+{{ view.reward.tickets }} <span>Jackpot tickets</span></strong><p>More chances in the season draw</p></div>
        </div>
        <div v-if="view.reward.diamonds" ref="diamondChip" class="rw ru-diamonds" :class="{ 'diamonds-only': !view.reward.tickets }">
          <DiamondIcon :size="view.reward.tickets ? 27 : 42" /><div><strong>+{{ view.reward.diamonds }} <span>Diamonds</span></strong><p v-if="!view.reward.tickets">For your next player pack</p></div>
        </div>
        <p v-if="!view.reward.tickets && !view.reward.diamonds" class="ru-milestone">A new milestone in your climb.</p>
      </section>
      <p id="promotion-description" class="ru-note">{{ view.reward.tickets ? 'Climb the ranks. Earn tickets. Chase the jackpot.' : 'Keep building your squad. Keep climbing.' }}</p>
    </div>
    <footer class="ru-footer"><button class="btn ru-go" @click="dismiss">Continue <span aria-hidden="true">→</span></button><p>Milestone rewards are earned once per season.</p></footer>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import DiamondIcon from '../components/DiamondIcon.vue'
import RankCrest from '../components/RankCrest.vue'
import VictoryParticles from '../components/VictoryParticles.vue'
import ticketArt from '../assets/rank-art/tickets.webp'
import { store } from '../game.js'
import { RANK_TIERS, ladderIndex, ladderLabel, SUBTIER_LABEL } from '../engine/economy.js'
import { uiPlay, UI_TIME, reduced } from '../ui/motion.js'
import { flyTo } from '../ui/flyIn.js'

const view = computed(() => store.rankUpView || { label: '', reward: {} })
const tierIndex = computed(() => Math.max(0, RANK_TIERS.findIndex(t => view.value.label.startsWith(t.name))))
const subtier = computed(() => Number(Object.keys(SUBTIER_LABEL).find(k => view.value.label.endsWith(' ' + SUBTIER_LABEL[k]))) || 3)
const tierColour = computed(() => RANK_TIERS[tierIndex.value].colour)
const previousLabel = computed(() => ladderLabel(Math.max(0, ladderIndex(tierIndex.value, subtier.value) - 1)))
const newLeague = computed(() => subtier.value === 3 && tierIndex.value > 0)
const dialogEl = ref(null), crestEl = ref(null), shineEl = ref(null), rewardEl = ref(null), diamondChip = ref(null), ticketChip = ref(null)
let anim, closing = false, priorFocus, inertSiblings = []
// Rewards are already credited by finishMatch. Dismissal is presentation only.
function dismiss () {
  if (closing) return
  closing = true
  anim?.skip()
  const reward = view.value.reward
  if (!reduced.value) {
    if (reward.diamonds && diamondChip.value) flyTo(diamondChip.value, 'diamonds', { glyph: '◆' })
    if (reward.tickets && ticketChip.value) flyTo(ticketChip.value, '[data-tab="rank"]', { icon: 'ticket', count: Math.min(5, reward.tickets) })
  }
  store.overlay = null
  store.rankUpView = null
}
function onKey (event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss() }
  if (event.key === 'Tab') { event.preventDefault(); dialogEl.value.querySelector('.ru-go').focus() }
}
onMounted(() => {
  priorFocus = document.activeElement
  inertSiblings = [...document.querySelectorAll('.phone .topbar, .phone .screen, .phone .tabbar')].map(el => [el, el.inert])
  inertSiblings.forEach(([el]) => { el.inert = true })
  dialogEl.value.focus({ preventScroll: true })
  const d = UI_TIME.rankUp
  anim = uiPlay('rankUp', tl => {
    // The tier and reward amounts remain readable from the first frame.
    tl.fromTo(crestEl.value, { scale: .84, rotation: -5 }, { scale: 1, rotation: 0, duration: d * .6, ease: 'back.out(1.4)' }, 0)
    tl.fromTo(rewardEl.value, { y: 10 }, { y: 0, duration: d * .4, ease: 'power2.out' }, d * .15)
    tl.fromTo(shineEl.value, { backgroundPosition: '150% 0', opacity: 0 }, { backgroundPosition: '-150% 0', opacity: .7, duration: d * .8, ease: 'power2.inOut' }, d * .2)
  }, { interruptible: d > 1, onEnd: () => { if (shineEl.value) shineEl.value.style.opacity = '0' } })
})
onUnmounted(() => {
  anim?.cancel()
  inertSiblings.forEach(([el, wasInert]) => { if (el.isConnected) el.inert = wasInert })
  if (priorFocus?.isConnected) priorFocus.focus({ preventScroll: true })
})
</script>

<style scoped>
.ru { position:absolute; inset:0; z-index:60; outline:none; display:flex; flex-direction:column; min-height:0; overflow:hidden; isolation:isolate; color:#f3f8fc; background:#06121e url('../assets/rank-art/promotion-stadium.webp') center / cover no-repeat; }
.ru-atmosphere { position:absolute; inset:0; z-index:-1; pointer-events:none; background:linear-gradient(180deg,#04101b50 0%,#04101b15 45%,#04101bd9 76%,#04101bf5),radial-gradient(ellipse at 50% 38%,color-mix(in srgb,var(--promotion-accent) 15%,transparent),transparent 65%); }
.ru :deep(.ru-particles) { opacity:.46; z-index:-1; }
.ru-tier-1 :deep(.ru-particles) { filter:saturate(.15); }
.ru-in { flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; gap:14px; padding:38px 22px 10px; }
.ru-heading { text-align:center; flex:none; }.ru-kicker { display:inline-flex; align-items:center; gap:8px; color:#d6e7ef; font-size:11px; font-weight:800; letter-spacing:.22em; }.ru-kicker > span { display:grid; place-items:center; width:24px; height:24px; border:1px solid #c8dde866; border-radius:50%; font-size:16px; letter-spacing:0; }.ru-heading p { font-size:18px; color:#edf6fb; font-weight:600; margin:9px 0 0; }
.ru-hero { flex:1; min-height:0; display:flex; flex-direction:column; justify-content:center; align-items:center; width:100%; }
.ru-emblem { position:relative; flex:1; min-height:0; width:100%; max-height:310px; display:flex; align-items:center; justify-content:center; isolation:isolate; }
.ru-emblem :deep(.rank-crest) { width:auto; height:100%; max-height:260px; aspect-ratio:1; margin:0; min-height:0; }
.ru-emblem :deep(.crest-number) { font-size:clamp(38px,6vh,70px); }
.ru-emblem-light { position:absolute; inset:10% 6%; z-index:-1; background:radial-gradient(ellipse,color-mix(in srgb,var(--promotion-accent) 32%,transparent),transparent 68%); filter:blur(8px); }
.ru-shine { position:absolute; inset:8% 28%; pointer-events:none; opacity:0; background:linear-gradient(110deg,transparent 42%,#fff9d950 49%,transparent 57%); background-size:300% 100%; background-repeat:no-repeat; mix-blend-mode:screen; }
.ru-league { flex:none; font-size:9px; font-weight:800; letter-spacing:.2em; color:#d0e0ea; margin:8px 0 4px; }
.ru-tier { flex:none; font-size:42px; line-height:1.15; font-weight:900; letter-spacing:-.035em; margin:0; color:var(--promotion-accent); text-align:center; text-shadow:0 3px 18px #000; }
.ru-path { flex:none; display:flex; align-items:center; gap:12px; font-size:11px; color:#aebfcd; margin-top:12px; }.ru-path strong { color:#f1f7fc; background:#29404b88; padding:5px 10px; border:1px solid color-mix(in srgb,var(--promotion-accent) 40%,transparent); border-radius:6px; }.ru-path-arrow { color:var(--promotion-accent); font-size:19px; }
.ru-rewards { flex:none; width:100%; max-width:390px; border:1px solid color-mix(in srgb,var(--promotion-accent) 50%,#243c4a); border-radius:16px; padding:15px 16px; background:linear-gradient(125deg,#1e3442eb,#101e2af5); box-shadow:0 10px 28px #0004; }
.ru-rewards > header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }.ru-rewards h2 { font-size:11px; font-weight:700; color:#c9dbe6; }.ru-received { font-size:8px; letter-spacing:.08em; font-weight:800; color:#87e6b4; }.ru-received > span { margin-right:3px; }
.rw { display:flex; align-items:center; gap:12px; min-width:0; }.rw strong { display:block; font-size:29px; line-height:1.15; font-variant-numeric:tabular-nums; color:#fff0c3; }.rw strong > span { display:block; color:#f2f7fa; font-size:15px; margin-top:3px; }.rw p { font-size:10px; line-height:1.5; margin:6px 0 0; color:#b8cdd9; }
.ru-ticket-art { width:76px; height:76px; object-fit:contain; flex:none; filter:drop-shadow(0 4px 8px #0005); }
.ru-diamonds { padding-top:12px; border-top:1px solid #69818e40; margin-top:13px; }.ru-diamonds > div { display:flex; align-items:baseline; gap:6px; }.ru-diamonds strong { font-size:18px; color:#c3f3ff; }.ru-diamonds strong > span { display:inline; font-size:12px; color:#c8dce6; margin-left:4px; }.diamonds-only { padding:5px 0; margin:0; border:0; min-height:76px; }.diamonds-only > div { display:block; }.diamonds-only strong { font-size:30px; }.diamonds-only strong > span { display:block; font-size:15px; margin-left:0; }
.ru-milestone { font-size:14px; margin:12px 0; text-align:center; color:#d1e3ed; }
.ru-note { flex:none; margin:0; font-size:10px; line-height:1.5; color:#c1d5e1; text-align:center; max-width:330px; }
.ru-footer { flex:none; position:relative; width:100%; padding:12px 22px max(18px,env(safe-area-inset-bottom)); background:linear-gradient(#06121e10,#06121ef0 35%); }.ru-go { display:flex; align-items:center; justify-content:center; gap:14px; width:100%; min-height:48px; background:linear-gradient(110deg,#75f2b2,#2ddb7a); color:#062417; border:1px solid #a5fbd333; font-size:16px; font-weight:800; box-shadow:0 5px 22px #32d98d18; }.ru-go > span { font-size:22px; line-height:1; }.ru-footer p { color:#8fa9b9; text-align:center; font-size:9px; margin:10px 0 0; }
.ru-go:focus-visible { outline:2px solid #eafff5; outline-offset:3px; }
@media(max-height:760px) { .ru-in { padding-top:23px; gap:10px; }.ru-heading p { font-size:16px; margin-top:6px; }.ru-emblem { max-height:230px; }.ru-emblem :deep(.rank-crest) { max-height:200px; }.ru-tier { font-size:35px; }.ru-path { margin-top:7px; }.ru-rewards { padding:12px 14px; }.ru-rewards > header { margin-bottom:7px; }.ru-ticket-art { width:62px; height:62px; }.rw strong { font-size:25px; }.rw strong > span { font-size:13px; }.ru-diamonds { padding-top:9px; margin-top:10px; }.ru-diamonds strong { font-size:17px; }.ru-diamonds strong > span { font-size:12px; }.ru-footer { padding:9px 18px 12px; } }
@media(max-height:620px) { .ru-in { padding-top:12px; gap:7px; }.ru-kicker { font-size:9px; }.ru-kicker > span { width:20px; height:20px; }.ru-heading p { font-size:14px; }.ru-league { margin-top:4px; font-size:8px; }.ru-tier { font-size:28px; }.ru-path { font-size:10px; gap:8px; margin-top:4px; }.ru-rewards { padding:9px 12px; }.ru-ticket-art { width:49px; height:49px; }.rw { gap:9px; }.rw strong { font-size:23px; }.rw strong > span { font-size:12px; }.rw p { font-size:9px; margin-top:3px; }.ru-diamonds { padding-top:7px; margin-top:8px; }.ru-diamonds strong { font-size:15px; }.ru-diamonds strong > span { font-size:11px; }.ru-note { font-size:9px; }.ru-footer { padding:7px 16px 9px; }.ru-footer p { margin-top:6px; font-size:8px; }.ru-go { min-height:44px; font-size:15px; }.ru-emblem :deep(.crest-number) { font-size:30px; } }
@media(prefers-reduced-motion:reduce) { .ru-shine { display:none; } }
</style>
