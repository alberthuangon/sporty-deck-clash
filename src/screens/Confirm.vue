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
        <span class="muted">If you win</span>
        <b>₦{{ potential.toLocaleString() }}</b>
      </div>
      <div class="pay-sum muted">
        ₦{{ stake }} × {{ matchView.myOdds.toFixed(2) }} = ₦{{ potential.toLocaleString() }}
        · profit ₦{{ (potential - stake).toLocaleString() }}
        <span class="locked">— price locked whatever the toss</span>
      </div>
    </div>

    <!-- The toss moves your chances, never your price, so this reads in
         probabilities. The two figures are separate branches rather than a
         split and do not sum to 100 (75.7%-124.3% across matched pairings),
         so they sit in two "if" boxes instead of one bar. -->
    <div class="toss card" v-if="chances">
      <div class="t-head">Coin toss → your chance of winning</div>
      <div class="t-cases">
        <div class="t-case" :class="{ lead: chances.home >= chances.away }">
          <span class="muted">if you're HOME</span>
          <b>{{ (chances.home * 100).toFixed(0) }}%</b>
        </div>
        <div class="t-case" :class="{ lead: chances.away > chances.home }">
          <span class="muted">if you're AWAY</span>
          <b>{{ (chances.away * 100).toFixed(0) }}%</b>
        </div>
      </div>
      <div class="t-note muted">
        The toss changes your chances, not your payout. Both sides pay the same
        <b>{{ (MARGIN * 100).toFixed(0) }}% margin</b>, whatever cards you hold.
      </div>
    </div>

    <div class="fineprint muted">
      Anything above the arena floor is covered by the platform — your opponent
      does not have to match it, and their stake is not shown.
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
import { store, go, matchView, ctx, cardOf, deckPower, confirmBet, stakeRange, abandonMatch, tossChances } from '../game.js'
import { MARGIN } from '../engine/model.js'

const SLOTS = ['gk', 'df', 'mf', 'fw']
const range = computed(() => stakeRange(matchView.tierFee))
const stake = ref(matchView.tierFee)
const myPower = computed(() => deckPower())
const chances = computed(() => tossChances())
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
.pay span.muted { font-size: 12px; }
.pay b { font-size: 26px; font-weight: 800; color: var(--green); font-variant-numeric: tabular-nums; }
.locked { color: var(--text-3); }
.pay-sum { font-size: 10px; text-align: right; margin-top: 6px; font-variant-numeric: tabular-nums; }
.toss { padding: 10px 12px; }
.t-head { font-size: 11px; font-weight: 700; color: var(--text-2); margin-bottom: 7px; }
.t-cases { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.t-case {
  background: var(--surface-hi); border-radius: var(--r-sm); padding: 7px 10px;
  display: flex; align-items: baseline; justify-content: space-between; gap: 6px;
  border: 1px solid transparent;
}
.t-case.lead { border-color: var(--cta-deep); }
.t-case span { font-size: 9px; letter-spacing: .03em; }
.t-case b { font-size: 17px; font-variant-numeric: tabular-nums; }
.t-note { font-size: 10px; line-height: 1.5; margin-top: 8px; }
.t-note b { color: var(--text-2); }
.fineprint { font-size: 10px; line-height: 1.55; margin: 0 2px; }
.fineprint b { color: var(--text-2); }
.fine { font-size: 10px; line-height: 1.45; text-align: center; }
</style>
