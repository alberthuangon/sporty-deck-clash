<template>
  <div class="scroll pad to">
    <div class="coin" :class="[{ done: revealed }, revealed ? side : '']" data-sfx="toss">
      <span v-if="!revealed">?</span>
      <span v-else>{{ iAmHome ? 'H' : 'A' }}</span>
    </div>
    <div class="t-status" :class="revealed ? side : ''">
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

    <button v-if="revealed" class="btn btn-cta" @click="go('match')">Kick off</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { go, runToss, matchView, branchQuotes } from '../game.js'

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

let t
onMounted(() => {
  const res = runToss()
  iAmHome.value = res.aIsHome
  t = setTimeout(() => { revealed.value = true }, 1600)
})
onUnmounted(() => clearTimeout(t))
</script>

<style scoped>
.to { display: flex; flex-direction: column; align-items: center; gap: 13px; padding-top: 46px; }
.coin {
  width: 104px; height: 104px; border-radius: 50%;
  background: linear-gradient(145deg, #4A5160, #262A33);
  border: 2px solid var(--divider);
  display: flex; align-items: center; justify-content: center;
  font-size: 38px; font-weight: 800;
  animation: flip .35s linear infinite;
}
/* Mint leaves this screen entirely. The toss is the one moment the game says
   which side you are, and it was saying it in the colour that means "win" —
   with a red odds cell sitting inside a green ring after batch 2. The only
   green left here is Kick off, which is an action rather than an identity. */
.coin.done { animation: none; }
.coin.done.home {
  border-color: var(--home); color: var(--home-on);
  background:
    radial-gradient(circle at 50% 42%, rgba(var(--home-rgb), .34), transparent 68%),
    linear-gradient(145deg, #4A5160, #262A33);
  box-shadow: 0 0 22px rgba(var(--home-rgb), .40);
}
.coin.done.away {
  border-color: var(--away); color: var(--away-on);
  background:
    radial-gradient(circle at 50% 42%, rgba(var(--away-rgb), .34), transparent 68%),
    linear-gradient(145deg, #4A5160, #262A33);
  box-shadow: 0 0 22px rgba(var(--away-rgb), .40);
}
.t-status.home { color: var(--home-on); }
.t-status.away { color: var(--away-on); }
@keyframes flip { 50% { transform: scaleX(.08); } }
.t-status { font-size: 17px; font-weight: 800; }

.locks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
.lock {
  background: var(--surface); border: 1px solid var(--divider); border-radius: var(--r-md);
  padding: 9px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  transition: opacity .45s ease, border-color .45s ease, transform .45s ease;
}
/* the label names a branch, which is known before the toss and is not a
   spoiler — the same reason the two odds cells are already coloured */
.l-case { font-size: 10px; font-weight: 800; letter-spacing: .1em; color: var(--text-2); }
.lock.home .l-case { color: var(--home-on); }
.lock.away .l-case { color: var(--away-on); }
.lock.dead .l-case { color: var(--text-2); }
.l-cell { padding: 6px 0; width: 100%; font-size: 20px; }
.lock.hit { transform: scale(1.04); }
.lock.hit.home { border-color: var(--home); box-shadow: 0 0 16px rgba(var(--home-rgb), .30); }
.lock.hit.away { border-color: var(--away); box-shadow: 0 0 16px rgba(var(--away-rgb), .30); }
.lock.dead { opacity: .22; }

.t-detail { font-size: 13px; text-align: center; line-height: 1.5; }
.t-fine { font-size: 10px; text-align: center; line-height: 1.5; max-width: 290px; }
.to > .btn { width: 100%; margin-top: 4px; }
</style>
