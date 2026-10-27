<template>
  <div class="scroll pad cf" v-if="matchView.active">
    <div class="vs card">
      <div class="side">
        <div class="s-name">You</div>
        <PowerStars :q="myPower" />
      </div>
      <div class="vs-x">VS</div>
      <div class="side right">
        <div class="s-name">{{ matchView.opponentName }}</div>
        <PowerStars :q="matchView.opponentPower" />
      </div>
    </div>

    <div class="lineups card">
      <div v-for="s in SLOTS" :key="s" class="lrow">
        <span class="ln">{{ cardOf(store.deck[s]).name }}</span>
        <span class="lp muted">{{ s.toUpperCase() }}</span>
        <span class="ln right">{{ oppCard(s).name }}</span>
      </div>
    </div>

    <!-- stake, rate and payout in one card. The price used to sit in its own
         block above the branch prices, which made the number that actually
         pays look notional and the two that never pay look real. Putting it
         between the stake and the payout makes its job unmissable. -->
    <div class="stake card">
      <div class="st-head">
        <span class="muted">Your stake</span>
        <span class="st-v">₦{{ stake }}</span>
      </div>
      <input class="slider" type="range" :min="range.min" :max="range.max" step="1" v-model.number="stake" />
      <div class="st-ends muted">
        <span>₦{{ range.min }}</span><span>₦{{ range.max }}</span>
      </div>

      <div class="quotes" v-if="quotes">
        <div class="q-row">
          <span class="q-case muted">if you're HOME</span>
          <span class="odds-cell home q-cell">{{ quotes.home.toFixed(2) }}</span>
          <span class="q-win">win <b>₦{{ winHome.toLocaleString() }}</b></span>
        </div>
        <div class="q-row">
          <span class="q-case muted">if you're AWAY</span>
          <span class="odds-cell away q-cell">{{ quotes.away.toFixed(2) }}</span>
          <span class="q-win">win <b>₦{{ winAway.toLocaleString() }}</b></span>
        </div>
      </div>
    </div>

    <div class="fineprint muted">
      Both prices are locked now. The coin toss after you confirm only reveals
      which one applies — it is already drawn, and neither of you can act on it.
      Both sides pay the same <b>{{ (MARGIN * 100).toFixed(0) }}% margin</b>,
      whatever cards you hold. Anything above the arena floor is covered by the
      platform — your opponent does not have to match it, and their stake is
      not shown.
    </div>

    <div class="btn-row">
      <button class="btn" @click="cancel">Cancel</button>
      <button class="btn btn-cta" :disabled="store.cash < stake" data-sfx="confirm" @click="accept">
        Confirm ₦{{ stake }}
      </button>
    </div>
    <div class="fine muted">Stakes lock at the coin toss.</div>
  </div>
  <div v-else class="scroll pad">
    <div class="empty"><div class="empty-t">No active match.</div></div>
    <button class="btn" @click="go('home')">Back home</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PowerStars from '../components/PowerStars.vue'
import { store, go, matchView, ctx, cardOf, deckPower, confirmBet, stakeRange, abandonMatch, branchQuotes } from '../game.js'
import { MARGIN } from '../engine/model.js'

const SLOTS = ['gk', 'df', 'mf', 'fw']
const range = computed(() => stakeRange(matchView.tierFee))
const stake = ref(matchView.tierFee)
const myPower = computed(() => deckPower())
const quotes = computed(() => branchQuotes())
const winHome = computed(() => quotes.value ? Math.floor(stake.value * quotes.value.home) : 0)
const winAway = computed(() => quotes.value ? Math.floor(stake.value * quotes.value.away) : 0)
function oppCard (s) { return ctx.opponent ? ctx.opponent.team.cards[s] : { name: '—' } }
function accept () { if (confirmBet(stake.value)) go('toss') }
function cancel () { abandonMatch(); go('home') }
</script>

<style scoped>
.cf { display: flex; flex-direction: column; gap: 10px; }
.vs { display: flex; align-items: center; justify-content: space-between; padding: 12px; }
.side { min-width: 0; }
.side.right { text-align: right; }
.s-name { font-weight: 800; font-size: 14px; margin-bottom: 4px; }
.side.right .s-name { color: var(--text-2); font-weight: 700; }
.vs-x { font-size: 11px; color: var(--text-2); font-weight: 800; padding: 0 8px; }
.lineups { padding: 4px 12px; }
.lrow { display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--divider); font-size: 12px; }
.lrow:last-child { border-bottom: 0; }
/* Which row is mine, without saying which SIDE I am — the assignment is
   still sealed at this point (src/game.js). Weight and lightness answer
   "which one is me" on their own, and inventing a fourth colour family for
   it would dilute the three that already carry meaning. */
.ln { flex: 1; color: var(--text); font-weight: 700; }
.ln.right { text-align: right; color: var(--text-2); font-weight: 400; }
.lp { width: 34px; text-align: center; font-size: 10px; font-weight: 700; }
.stake { padding: 12px; }
.st-head { display: flex; justify-content: space-between; align-items: baseline; }
.st-v { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.slider { width: 100%; margin: 10px 0 2px; accent-color: var(--cta); }
.st-ends { display: flex; justify-content: space-between; font-size: 10px; }
.quotes { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--divider); display: flex; flex-direction: column; gap: 7px; }
.q-row { display: flex; align-items: center; gap: 10px; }
.q-case { font-size: 10px; letter-spacing: .03em; width: 84px; flex: 0 0 84px; }
.q-cell { padding: 5px 0; font-size: 17px; width: 62px; flex: 0 0 62px; }
.q-win { margin-left: auto; font-size: 11px; color: var(--text-2); }
.q-win b { font-size: 18px; color: var(--green); margin-left: 5px; font-variant-numeric: tabular-nums; }
.fineprint { font-size: 10px; line-height: 1.55; margin: 0 2px; }
.fineprint b { color: var(--text-2); }
.fine { font-size: 10px; line-height: 1.45; text-align: center; }
</style>
