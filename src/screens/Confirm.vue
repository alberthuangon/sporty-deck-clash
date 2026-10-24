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

    <div class="odds">
      <OddsCell label="You win" :odds="matchView.myOdds" big />
      <OddsCell :label="matchView.opponentName" :odds="matchView.theirOdds" big />
    </div>

    <div class="stake card">
      <div class="st-head">
        <span class="muted">Your stake</span>
        <span class="st-v">₦{{ stake }}</span>
      </div>
      <input class="slider" type="range" :min="range.min" :max="range.max" step="1" v-model.number="stake" />
      <div class="st-ends muted">
        <span>₦{{ range.min }}</span><span>₦{{ range.max }}</span>
      </div>
      <div class="st-note muted">
        Base stake is the arena floor. Anything above it is covered by the platform —
        your opponent does not have to match it, and their stake is not shown.
      </div>
      <div class="win">
        <span class="muted">If you win</span>
        <span class="win-v">₦{{ potential.toLocaleString() }}</span>
      </div>
      <div class="win sub">
        <span class="muted">Profit</span>
        <span>₦{{ (potential - stake).toLocaleString() }}</span>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn" @click="cancel">Cancel</button>
      <button class="btn btn-cta" :disabled="store.cash < stake" data-sfx="confirm" @click="accept">
        Confirm ₦{{ stake }}
      </button>
    </div>
    <div class="fine muted">
      Stakes lock at the coin toss. Odds were priced before the toss, so the
      toss is expectation-neutral for both sides.
    </div>
  </div>
  <div v-else class="scroll pad">
    <div class="locked-note">No active match.</div>
    <button class="btn" @click="go('home')">Back home</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import PowerStars from '../components/PowerStars.vue'
import OddsCell from '../components/OddsCell.vue'
import { store, go, matchView, ctx, cardOf, deckPower, confirmBet, stakeRange, abandonMatch } from '../game.js'

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
.odds { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stake { padding: 12px; }
.st-head { display: flex; justify-content: space-between; align-items: baseline; }
.st-v { font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.slider { width: 100%; margin: 10px 0 2px; accent-color: var(--cta); }
.st-ends { display: flex; justify-content: space-between; font-size: 10px; }
.st-note { font-size: 10px; line-height: 1.45; margin: 8px 0 10px; }
.win { display: flex; justify-content: space-between; align-items: baseline; padding-top: 8px; border-top: 1px solid var(--divider); }
.win-v { font-size: 22px; font-weight: 800; color: var(--green); font-variant-numeric: tabular-nums; }
.win.sub { border-top: 0; padding-top: 2px; font-size: 12px; }
.fine { font-size: 10px; line-height: 1.45; text-align: center; }
</style>
