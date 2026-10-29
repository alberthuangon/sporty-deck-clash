<template>
  <div class="mm" :class="{ found: ready, 'motion-reduced': reduced }">
    <div class="match-content scroll">
      <header class="match-heading">
        <div class="arena-pill" :class="{ matched: ready }">
          <span v-if="ready" class="match-check" aria-hidden="true">✓</span>
          {{ ready ? 'MATCH FOUND' : arenaName }}
        </div>
        <h1 role="status" aria-live="polite">{{ failed ? 'No rival available.' : ready ? 'Your rival is ready.' : 'Finding your rival…' }}</h1>
        <p>{{ failed ? 'Please try again from Play.' : ready ? 'A new match. A new challenge.' : 'Get ready for your next match.' }}</p>
      </header>

      <div class="duel-space" :class="{ searching: !ready && !failed }">
        <div class="duel-row">
          <div class="team you">
            <div class="crest-stage"><DuelCrest :label="GAME_MONOGRAM" /></div>
            <div class="team-name">You</div>
            <div class="team-power">POWER {{ myScore }}</div>
          </div>
          <div class="versus" aria-hidden="true"><span>VS</span></div>
          <div class="team rival" :class="{ revealed: ready }">
            <div class="crest-stage">
              <div v-if="!ready && !failed" class="ghosts" aria-hidden="true">
                <DuelCrest v-for="i in 3" :key="i" label="?" :style="{ '--ghost-index': i }" />
              </div>
              <DuelCrest :label="ready ? opponentInitials : '?'" class="rival-crest" />
              <span v-for="(spark, i) in sparks" :key="i" class="spark" aria-hidden="true"
                    :style="{ '--dx': spark.x + 'px', '--dy': spark.y + 'px', '--delay': spark.delay + 's', '--turn': spark.turn + 'deg' }"></span>
            </div>
            <div class="team-name">{{ ready ? matchView.opponentName : failed ? 'Unavailable' : 'Searching…' }}</div>
            <div class="team-power">{{ ready ? 'POWER ' + opponentScore : '' }}</div>
          </div>
        </div>
      </div>

      <div class="match-caption">
        <div class="search-dots" :class="{ complete: ready || failed }" aria-hidden="true"><i></i><i></i><i></i></div>
        <p :class="{ success: ready }">{{ failed ? 'Your squad is ready for another try.' : ready ? 'Your squad. Your next challenge.' : 'Searching for an opponent' }}</p>
        <span>{{ ready ? arenaName + ' · 4 PLAYERS EACH' : '' }}</span>
      </div>
    </div>

    <!-- One persistent control, outside the scrolling/animated scene. Neither
         label changes nor reveal effects can alter its layout rectangle. -->
    <footer class="match-actions">
      <button class="btn" :class="{ 'btn-cta': ready }" :disabled="leaving" @click="act">
        <span>{{ ready ? 'Review match' : failed ? 'Back to Play' : 'Cancel search' }}</span>
        <span class="action-arrow" aria-hidden="true">›</span>
      </button>
      <p class="action-copy">{{ ready ? 'Review your stake before kick-off.' : '' }}</p>
    </footer>
  </div>
</template>

<script setup>
import { GAME_MONOGRAM } from '../branding.js'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import DuelCrest from '../components/DuelCrest.vue'
import { store, go, startMatchmaking, deckPower, powerScore, abandonMatch, matchView, TIERS } from '../game.js'
import { screenBack } from '../store.js'
import { reduced } from '../ui/motion.js'

const ready = ref(false)
const failed = ref(false)
const leaving = ref(false)
const fee = store.pendingTier || TIERS[0].fee
const arenaName = computed(() => TIERS.find(t => t.fee === fee)?.name || 'Arena')
const myScore = computed(() => powerScore(deckPower()))
const opponentScore = computed(() => powerScore(matchView.opponentPower))
const opponentInitials = computed(() => matchView.opponentName.slice(0, 2).toUpperCase())
const sparks = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2
  const distance = 67 + (i % 4) * 8
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, delay: (i % 5) * .025, turn: i * 20 }
})
let revealTimer = null
let found = false

function reveal () {
  clearTimeout(revealTimer)
  if (found && !leaving.value) ready.value = true
}
function cancel () {
  if (leaving.value) return
  leaving.value = true
  clearTimeout(revealTimer)
  abandonMatch()
  go('home')
}
function act () {
  if (leaving.value) return
  if (!ready.value) { cancel(); return }
  leaving.value = true
  go('confirm')
}
onMounted(() => {
  screenBack.value = cancel
  found = !!startMatchmaking(fee)
  if (!found) { failed.value = true; return }
  // Pairing is already complete. This short presentation reveals it without
  // exposing queue internals, changing odds or introducing another bet.
  if (reduced.value) reveal()
  else revealTimer = setTimeout(reveal, 1800)
})
watch(reduced, value => { if (value) reveal() })
onUnmounted(() => {
  clearTimeout(revealTimer)
  if (screenBack.value === cancel) screenBack.value = null
})
</script>

<style scoped>
.mm { display: flex; flex-direction: column; min-height: 0; overflow: hidden; isolation: isolate; background: linear-gradient(180deg,#06111e35 0%,#06111e0d 48%,#07121d33 75%,#07121ee6 100%),url('../assets/matchmaking-art/stadium.webp') center/cover no-repeat,#07121e; }
.match-content { display: flex; flex-direction: column; min-height: 0; padding: 28px 20px 0; scrollbar-width: none; }
.match-content::-webkit-scrollbar { display: none; }
.match-heading { flex: none; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 13px; }
.arena-pill { display: flex; justify-content: center; align-items: center; gap: 9px; min-height: 34px; width: 190px; padding: 6px 12px; border: 1px solid #8da6bd80; border-radius: 999px; background: #1c304386; color: #b1c7dd; font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
.arena-pill.matched { color: #73f3ad; border-color: #45e78b; background: #063a2399; }
.match-check { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: #53eb97; color: #063622; font-size: 13px; font-weight: 900; }
h1 { margin: 4px 0 0; min-height: 70px; display: flex; align-items: center; justify-content: center; font-size: 31px; line-height: 1.12; letter-spacing: -.045em; font-weight: 900; text-shadow: 0 3px 15px #0008; }
.match-heading p { margin: -9px 0 0; min-height: 19px; color: #bed1e5; font-size: 13px; }
.duel-space { position: relative; flex: 1; min-height: 290px; display: flex; align-items: center; justify-content: center; }
.duel-space::before { content: ''; position: absolute; width: 90%; height: 130px; left: 5%; top: calc(50% - 90px); background: radial-gradient(ellipse,#40ff9a23,transparent 68%); pointer-events: none; }
.duel-row { width: 100%; display: grid; grid-template-columns: minmax(0,1fr) 61px minmax(0,1fr); align-items: center; gap: 0; }
.team { position: relative; min-width: 0; z-index: 1; display: flex; flex-direction: column; align-items: center; }
.crest-stage { position: relative; width: 148px; height: 180px; display: flex; align-items: center; justify-content: center; perspective: 700px; }
.team-name { width: 100%; min-height: 23px; margin-top: 10px; text-align: center; font-size: 16px; line-height: 1.25; font-weight: 800; overflow-wrap: anywhere; text-shadow: 0 2px 8px #000; }
.team-power { min-height: 18px; margin-top: 3px; font-size: 10px; line-height: 18px; font-weight: 700; letter-spacing: .12em; color: #b9d0e5; }
.versus { position: relative; z-index: 2; align-self: center; margin-top: -51px; text-align: center; font-size: 19px; font-weight: 900; font-style: italic; color: #a7bdcf; }
.versus::before { content: ''; position: absolute; top: calc(50% - 1px); left: -47px; right: -47px; height: 2px; background: linear-gradient(90deg,transparent,#65f8b3,transparent); box-shadow: 0 0 13px #49eeab; z-index: -1; opacity: .5; }
.versus span { position: relative; display: block; background: #0b1b2d; border-radius: 999px; }
.ghosts { position: absolute; top: -12px; left: 0; width: 148px; height: 65px; pointer-events: none; }
.ghosts :deep(.duel-crest) { position: absolute; top: 0; width: 35px; left: calc((var(--ghost-index) - 1) * 52px); opacity: .18; animation: ghost-drift 1.2s ease-in-out infinite; animation-delay: calc(var(--ghost-index) * -.2s); }
.ghosts :deep(b) { font-size: 17px; }
.searching .rival-crest { opacity: .68; animation: crest-search .72s ease-in-out infinite alternate; }
.searching .rival .crest-stage::before, .searching .rival .crest-stage::after { content: ''; position: absolute; width: 174px; height: 174px; border-radius: 50%; pointer-events: none; }
.searching .rival .crest-stage::before { border: 1px solid #5ef1a450; box-shadow: 0 0 28px #3aff9725,inset 0 0 24px #3aff9715; }
.searching .rival .crest-stage::after { padding: 3px; background: conic-gradient(transparent 0 40%,#39e697 45% 62%,transparent 65% 88%,#adffd9 95% 99%,transparent); mask: linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0); animation: scanner-spin 1.35s linear infinite; filter: drop-shadow(0 0 5px #5affb1); }
.spark { position: absolute; left: calc(50% - 1px); top: calc(50% - 3px); width: 2px; height: 7px; border-radius: 100%; background: #aaffd4; opacity: 0; pointer-events: none; }
.found .rival .crest-stage::before { content: ''; position: absolute; inset: -8px; border-radius: 50%; background: radial-gradient(ellipse,#40ff9a55,transparent 70%); pointer-events: none; animation: reveal-bloom .85s ease-out both; }
.found .rival-crest { animation: crest-reveal .48s cubic-bezier(.16,.8,.25,1) both; }
.found .spark { animation: reveal-spark .9s ease-out both; animation-delay: var(--delay); }
.found .versus { color: #eef7ff; font-size: 43px; filter: drop-shadow(0 3px 3px #0009); }
.found .versus span { background: none; background-image: linear-gradient(160deg,#fff 20%,#c1d5e3 58%,#fff 65%,#7d9bac); background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: versus-enter .42s ease-out both; }
.found .versus::before { left: 50%; right: auto; top: calc(50% - 110px); width: 2px; height: 220px; transform: rotate(28deg); opacity: .9; background: linear-gradient(transparent,#7effc3 35%,#e1fff0 50%,#62f8aa 65%,transparent); box-shadow: 0 0 12px #49eeab; animation: slash-reveal .65s ease-out both; }
.match-caption { flex: none; min-height: 118px; text-align: center; padding: 0 0 18px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; }
.search-dots { display: flex; align-items: center; gap: 9px; height: 12px; }
.search-dots i { width: 8px; height: 8px; border-radius: 50%; background: #45eb99; box-shadow: 0 0 10px #5affaa66; animation: dot-pulse .9s ease-in-out infinite; }
.search-dots i:nth-child(2) { animation-delay: .15s; }
.search-dots i:nth-child(3) { animation-delay: .3s; }
.search-dots.complete { visibility: hidden; }
.search-dots.complete i { animation: none; }
.match-caption p { margin: 0; color: #c4d8eb; font-size: 13px; line-height: 19px; min-height: 19px; }
.match-caption p.success { color: #f1f6fc; font-weight: 800; }
.match-caption > span { min-height: 14px; font-size: 9px; line-height: 14px; color: #b3cce2; letter-spacing: .11em; text-transform: uppercase; }
.match-actions { flex: 0 0 120px; height: 120px; padding: 16px 20px 14px; background: linear-gradient(180deg,#07121e33,#07121ee6 80%); }
.match-actions .btn { position: relative; width: 100%; height: 48px; min-height: 48px; border: 1px solid #8aabc1; border-radius: 12px; background: #0d1c2b8c; color: #f2f7fc; }
.match-actions .btn.btn-cta { border-color: #30e977; background: linear-gradient(110deg,#34ee85,#1cde61); color: #062214; }
.action-arrow { color: transparent; position: absolute; right: 23px; top: 50%; transform: translateY(-50%); font-size: 29px; line-height: 1; }
.found .action-arrow { color: inherit; }
.action-copy { display: flex; align-items: center; justify-content: center; height: 32px; margin: 10px 0 0; color: #b9cee1; font-size: 11px; text-align: center; line-height: 16px; }
.btn:focus-visible { outline: 2px solid #a0ffcd; outline-offset: 3px; }
@keyframes scanner-spin { to { transform: rotate(360deg); } }
@keyframes dot-pulse { 0%,100% { opacity: .5; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes ghost-drift { 0%,100% { transform: translateY(4px); opacity: .08; } 50% { transform: translateY(-5px); opacity: .24; } }
@keyframes crest-search { from { transform: rotateY(-12deg); } to { transform: rotateY(12deg); } }
@keyframes crest-reveal { from { transform: translateY(-8px) rotateY(65deg) scale(.86); filter: brightness(1.8) drop-shadow(0 0 20px #65ffbd); } to { transform: translateY(0) rotateY(0) scale(1); filter: brightness(1) drop-shadow(0 8px 12px #0008); } }
@keyframes reveal-bloom { 0% { transform: scale(.45); opacity: 0; } 35% { opacity: 1; } 100% { transform: scale(1.2); opacity: .6; } }
@keyframes reveal-spark { 0% { transform: translate(0,0) rotate(var(--turn)) scale(.4); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(var(--dx),var(--dy)) rotate(var(--turn)) scale(.15); opacity: 0; } }
@keyframes versus-enter { from { transform: scale(1.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes slash-reveal { from { opacity: 0; transform: rotate(28deg) scaleY(.3); } to { opacity: .9; transform: rotate(28deg) scaleY(1); } }
.motion-reduced *, .motion-reduced *::before, .motion-reduced *::after { animation: none !important; }
.motion-reduced .spark { display: none; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; } .spark { display: none; } }
@media (max-width: 350px) {
  .match-content { padding: 22px 16px 0; }
  h1 { font-size: 26px; min-height: 59px; }
  .match-heading { gap: 10px; }
  .match-heading p { font-size: 11px; }
  .duel-space { min-height: 252px; }
  .duel-row { grid-template-columns: minmax(0,1fr) 48px minmax(0,1fr); }
  .crest-stage { width: 116px; height: 148px; }
  .crest-stage > :deep(.duel-crest) { width: 98px; }
  .crest-stage > :deep(.duel-crest b) { font-size: 38px; }
  .ghosts { width: 116px; }
  .ghosts :deep(.duel-crest) { width: 29px; left: calc((var(--ghost-index) - 1) * 42px); }
  .searching .rival .crest-stage::before, .searching .rival .crest-stage::after { width: 133px; height: 133px; }
  .team-name { font-size: 13px; }
  .team-power { font-size: 9px; letter-spacing: .08em; }
  .found .versus { font-size: 35px; }
  .match-caption { min-height: 99px; padding-bottom: 9px; gap: 9px; }
  .match-caption p { font-size: 11px; }
  .match-caption > span { font-size: 8px; letter-spacing: .08em; }
  .match-actions { padding-left: 16px; padding-right: 16px; }
}
</style>
