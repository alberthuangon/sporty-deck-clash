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

      <div class="pay">
        <div class="pay-rate">
          <span class="muted">Price</span>
          <span class="odds-cell pay-cell">{{ matchView.myOdds.toFixed(2) }}</span>
        </div>
        <div class="pay-win">
          <span class="muted">If you win</span>
          <b>₦{{ potential.toLocaleString() }}</b>
        </div>
      </div>
      <div class="pay-sum muted">
        ₦{{ stake }} × {{ matchView.myOdds.toFixed(2) }} = ₦{{ potential.toLocaleString() }}
        · profit ₦{{ (potential - stake).toLocaleString() }}
      </div>
    </div>

    <div class="fineprint muted">
      Anything above the arena floor is covered by the platform — your opponent
      does not have to match it, and their stake is not shown.
      Home or away is decided by a coin toss after both players confirm, so the
      price is neutral between the two. Both sides pay the same
      <b>{{ (MARGIN * 100).toFixed(0) }}% margin</b>, whatever cards you hold.
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
    <div class="locked-note">No active match.</div>
    <button class="btn" @click="go('home')">Back home</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PowerStars from '../components/PowerStars.vue'
import { store, go, matchView, ctx, cardOf, deckPower, confirmBet, stakeRange, abandonMatch } from '../game.js'
import { MARGIN } from '../engine/model.js'

const SLOTS = ['gk', 'df', 'mf', 'fw']
const range = computed(() => stakeRange(matchView.tierFee))
const stake = ref(matchView.tierFee)
const myPower = computed(() => deckPower())
const potential = computed(() => Math.floor(stake.value * matchView.myOdds))
function oppCard (s) { return ctx.opponent ? ctx.opponent.team.cards[s] : { name: '—' } }
function accept () { if (confirmBet(stake.value)) go('toss') }
function cancel () { abandonMatch(); go('home') }
</script>

<style scoped>
.cf { display: flex; flex-direction: column; gap: 10px; }
.vs { display: flex; align-items: center; justify-content: space-between; padding: 12px; }
.side { min-width: 0; }
.side.right { text-align: right; }
.s-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
.vs-x { font-size: 11px; color: var(--text-2); font-weight: 800; padding: 0 8px; }
.lineups { padding: 4px 12px; }
.lrow { display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--divider); font-size: 12px; }
.lrow:last-child { border-bottom: 0; }
.ln { flex: 1; }
.ln.right { text-align: right; }
.lp { width: 34px; text-align: center; font-size: 10px; font-weight: 700; }
.stake { padding: 12px; }
.st-head { display: flex; justify-content: space-between; align-items: baseline; }
.st-v { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.slider { width: 100%; margin: 10px 0 2px; accent-color: var(--cta); }
.st-ends { display: flex; justify-content: space-between; font-size: 10px; }
.pay {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--divider);
}
.pay-rate, .pay-win { display: flex; align-items: center; gap: 8px; }
.pay-rate span.muted, .pay-win span.muted { font-size: 11px; }
.pay-cell { padding: 5px 10px; font-size: 17px; }
.pay-win b { font-size: 24px; font-weight: 800; color: var(--green); font-variant-numeric: tabular-nums; }
.pay-sum { font-size: 10px; text-align: right; margin-top: 6px; font-variant-numeric: tabular-nums; }
.fineprint { font-size: 10px; line-height: 1.55; margin: 0 2px; }
.fineprint b { color: var(--text-2); }
.fine { font-size: 10px; line-height: 1.45; text-align: center; }
</style>
