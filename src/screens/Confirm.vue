<template>
  <div v-if="matchView.active" class="cf">
    <div class="confirm-content scroll">
      <h1 class="eyebrow">{{ arenaName }} · MATCH READY</h1>

      <section class="matchup panel" aria-label="Matchup">
        <div class="vs">
          <div class="side">
            <MatchCrest :label="GAME_MONOGRAM" />
            <div class="s-name">You</div>
            <span class="s-power">Squad Power <b>{{ powerScore(myPower) }}</b></span>
          </div>
          <span class="vs-x">VS</span>
          <div class="side">
            <MatchCrest :label="matchView.opponentName.slice(0, 2).toUpperCase()" />
            <div class="s-name">{{ matchView.opponentName }}</div>
            <span class="s-power">Squad Power <b>{{ powerScore(matchView.opponentPower) }}</b></span>
          </div>
        </div>
        <details class="lineups">
          <summary>
            <Icon name="players" :size="19" />
            <span class="disclosure-label">Compare lineups <small>4 players each</small></span>
            <span class="chevron" aria-hidden="true">⌄</span>
          </summary>
          <div class="lineup-body">
            <div v-for="s in SLOTS" :key="s" class="lrow">
              <span class="ln"><PlayerArt :card-id="cardOf(store.deck[s]).id" :size="28" eager />{{ cardOf(store.deck[s]).name }}</span>
              <span class="lp">{{ s.toUpperCase() }}</span>
              <span class="ln right">{{ oppCard(s).name }}<PlayerArt :card-id="oppCard(s).id" :size="28" eager /></span>
            </div>
          </div>
        </details>
      </section>

      <section class="stake panel" aria-labelledby="stake-heading">
        <div class="section-head">
          <h2 id="stake-heading"><label for="match-stake">Your stake</label></h2>
          <span>₦{{ range.min }}–₦{{ range.max }}</span>
        </div>
        <div class="amount-controls">
          <button class="stepper" aria-label="Decrease stake" :disabled="!validStake || stake <= range.min" @click="setStake(stake - 1)">−</button>
          <div class="amount-field" :class="{ invalid: !validStake }">
            <span aria-hidden="true">₦</span>
            <input id="match-stake" v-model="stakeInput" :style="{ width: Math.min(4, Math.max(2, stakeInput.length)) + 'ch' }" type="text" inputmode="numeric" autocomplete="off"
                   :aria-invalid="!validStake" :aria-describedby="!validStake ? 'stake-error' : undefined" />
          </div>
          <button class="stepper" aria-label="Increase stake" :disabled="!validStake || stake >= range.max" @click="setStake(stake + 1)">+</button>
        </div>
        <input class="slider" aria-label="Adjust stake" type="range" :min="range.min" :max="range.max" step="1"
               :value="validStake ? stake : range.min" @input="setStake($event.target.value)" />
        <div class="st-ends"><span>₦{{ range.min }}</span><span>₦{{ range.max }}</span></div>
        <div class="presets" role="group" aria-label="Quick stake amounts">
          <button v-for="amount in presets" :key="amount" :aria-pressed="validStake && stake === amount"
                  :class="{ selected: validStake && stake === amount }" @click="setStake(amount)">₦{{ amount }}</button>
        </div>
        <p v-if="!validStake" id="stake-error" class="stake-error" role="status">Enter a whole amount from ₦{{ range.min }} to ₦{{ range.max }}.</p>
        <p v-else-if="!affordable" class="stake-error" role="status">Insufficient balance. Choose a lower stake.</p>
      </section>

      <section v-if="quotes" class="returns panel" aria-labelledby="return-heading">
        <div class="section-head"><h2 id="return-heading">Potential return</h2><span>If you win</span></div>
        <div class="quotes">
          <div class="quote home">
            <div class="quote-top"><span>IF HOME</span><span class="quote-rate">{{ quotes.home.toFixed(2) }}×</span></div>
            <b class="quote-return">{{ validStake ? '₦' + winHome.toLocaleString() : '—' }}</b>
            <span class="quote-caption">Total return</span>
          </div>
          <div class="quote away">
            <div class="quote-top"><span>IF AWAY</span><span class="quote-rate">{{ quotes.away.toFixed(2) }}×</span></div>
            <b class="quote-return">{{ validStake ? '₦' + winAway.toLocaleString() : '—' }}</b>
            <span class="quote-caption">Total return</span>
          </div>
        </div>
        <p class="return-note">Includes your stake. Paid only if you win.</p>
      </section>

      <div class="side-note"><Icon name="info" :size="17" /><span>Your side is revealed after confirmation.</span></div>
      <details class="fineprint panel">
        <summary><Icon name="missions" :size="18" /><span>Bet details &amp; rules</span><span class="chevron" aria-hidden="true">⌄</span></summary>
        <p>Both prices are locked now. The coin toss after you confirm only reveals which one applies — it is already drawn, and neither of you can act on it. Both sides pay the same <b>{{ (MARGIN * 100).toFixed(0) }}% margin</b>, whatever cards you hold. Anything above the arena floor is covered by the platform — your opponent does not have to match it, and their stake is not shown.</p>
      </details>
    </div>
    <footer class="confirm-actions">
      <div class="btn-row">
        <button class="btn cancel" :disabled="accepting" @click="cancel">Cancel</button>
        <button class="btn btn-cta" :disabled="!validStake || !affordable || accepting" data-sfx="confirm" @click="accept">
          {{ validStake ? 'Confirm ₦' + stake.toLocaleString() : 'Confirm bet' }}
        </button>
      </div>
      <p>{{ validStake ? '₦' + stake.toLocaleString() : 'Your stake' }} is deducted when you confirm.</p>
    </footer>
  </div>
  <div v-else class="scroll pad">
    <div class="empty"><div class="empty-t">No active match.</div></div>
    <button class="btn" @click="go('home')">Back home</button>
  </div>
</template>

<script setup>
import { GAME_MONOGRAM } from '../branding.js'
import { ref, computed } from 'vue'
import MatchCrest from '../components/MatchCrest.vue'
import PlayerArt from '../components/PlayerArt.vue'
import { powerScore } from '../engine/model.js'
import Icon from '../components/Icon.vue'
import { store, go, matchView, ctx, cardOf, deckPower, confirmBet, stakeRange, abandonMatch, branchQuotes, TIERS } from '../game.js'
import { MARGIN } from '../engine/model.js'

const SLOTS = ['gk', 'df', 'mf', 'fw']
const range = computed(() => stakeRange(matchView.tierFee))
const arenaName = computed(() => TIERS.find(t => t.fee === matchView.tierFee)?.name || 'Arena')
const stakeInput = ref(String(matchView.tierFee))
const accepting = ref(false)
// Keep incomplete edits out of both the quote calculation and the payment call.
const stake = computed(() => /^\d+$/.test(stakeInput.value.trim()) ? Number(stakeInput.value) : NaN)
const validStake = computed(() => Number.isSafeInteger(stake.value) && stake.value >= range.value.min && stake.value <= range.value.max)
const affordable = computed(() => validStake.value && store.cash >= stake.value)
const presets = computed(() => [...new Set([range.value.min, range.value.min * 2, range.value.min * 3, range.value.max])].filter(n => n <= range.value.max))
const myPower = computed(() => deckPower())
const quotes = computed(() => branchQuotes())
const winHome = computed(() => validStake.value && quotes.value ? Math.floor(stake.value * quotes.value.home) : 0)
const winAway = computed(() => validStake.value && quotes.value ? Math.floor(stake.value * quotes.value.away) : 0)
function setStake (amount) { stakeInput.value = String(Math.min(range.value.max, Math.max(range.value.min, Number(amount)))) }
function oppCard (s) { return ctx.opponent ? ctx.opponent.team.cards[s] : { name: '—' } }
function accept () {
  if (accepting.value || !validStake.value || !affordable.value) return
  accepting.value = true
  if (confirmBet(stake.value)) go('toss')
  else accepting.value = false
}
function cancel () { abandonMatch(); go('home') }
</script>

<style scoped>
.s-power { display:flex; align-items:center; justify-content:center; gap:7px; font-size:10px; color:#b7cbd9; }.s-power b { font-size:16px; color:#fff; font-variant-numeric:tabular-nums; }
.cf { display: flex; flex-direction: column; min-height: 0; background: linear-gradient(180deg,#1019239c,#10151e 360px),url('../assets/shop-art/stadium.webp') center top/auto 340px no-repeat,#10151e; }
.confirm-content { display: flex; flex-direction: column; gap: 10px; min-height: 0; padding: 15px 18px 14px; scrollbar-width: none; }
.confirm-content::-webkit-scrollbar { display: none; }
.confirm-content > * { flex-shrink: 0; }
.eyebrow { text-align: center; color: #acbecd; font-size: 10px; font-weight: 800; letter-spacing: .13em; margin: 0 0 1px; text-transform: uppercase; }
.panel { border: 1px solid #819bad40; border-radius: 15px; background: linear-gradient(135deg,#25333ed9,#17232ee8); box-shadow: inset 0 1px 0 #ffffff08,0 4px 15px #0001; }
.vs { display: flex; align-items: center; padding: 12px 10px 11px; gap: 6px; }
.side { display: flex; flex: 1; min-width: 0; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
.side :deep(.match-crest) { width: 43px; height: 48px; }
.side :deep(.match-crest b) { font-size: 16px; }
.s-name { font-size: 14px; font-weight: 800; max-width: 100%; overflow-wrap: anywhere; }
.vs-x { flex: none; display: grid; place-items: center; width: 31px; height: 31px; border: 1px solid #8297aa55; border-radius: 50%; color: #bdccd9; font-size: 10px; font-weight: 800; }
summary { display: flex; align-items: center; gap: 10px; cursor: pointer; min-height: 44px; list-style: none; }
summary::-webkit-details-marker { display: none; }
.chevron { margin-left: auto; font-size: 19px; line-height: 1; color: #c6d5e4; }
details[open] > summary .chevron { transform: rotate(180deg); }
.lineups { border-top: 1px solid #8b9daf30; }
.lineups summary { padding: 7px 14px; color: #c9d7e4; }
.disclosure-label { font-size: 12px; font-weight: 700; }
.disclosure-label small { color: #9fb3c6; font-size: 10px; font-weight: 400; margin-left: 7px; }
.lineup-body { padding: 0 12px 7px; }
.lrow { display: flex; align-items: center; gap: 4px; padding: 7px 0; font-size: 11px; border-top: 1px solid #ffffff0b; }
.ln { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; font-weight: 700; }
.ln :deep(.pa) { border-radius: 6px; }
.ln.right { justify-content: flex-end; text-align: right; color: #b7c7d6; }
.lp { width: 24px; flex: none; color: #9fb1c3; font-size: 9px; text-align: center; }
.stake, .returns { padding: 12px 14px; }
.section-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
h2 { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -.02em; }
.section-head > span { font-size: 10px; color: #afc0d1; }
.amount-controls { display: flex; gap: 9px; align-items: stretch; margin-top: 9px; }
.stepper { width: 48px; min-height: 50px; flex: none; border: 1px solid #64dfa87a; border-radius: 12px; color: #56eb98; background: #32ce6210; font-size: 31px; font-weight: 700; }
.stepper:disabled { color: #8594a6; background: #ffffff04; border-color: #73869b55; cursor: default; }
.amount-field { display: flex; flex: 1; min-width: 0; justify-content: center; align-items: center; border: 1px solid #66e7a8; border-radius: 12px; background: #09131d80; color: #fff; padding: 0 8px; font-size: 38px; font-weight: 900; }
.amount-field input { width: 3ch; max-width: 100%; min-width: 0; border: 0; padding: 0; color: inherit; font: inherit; text-align: center; background: none; outline: none; font-variant-numeric: tabular-nums; }
.amount-field:focus-within { box-shadow: 0 0 0 2px #65e7a833; }
.amount-field.invalid { border-color: #fa8995; }
.slider { display: block; width: 100%; height: 28px; margin: 3px 0 0; accent-color: #46e68c; }
.st-ends { display: flex; justify-content: space-between; font-size: 9px; color: #9fb1c4; margin-top: -2px; }
.presets { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin-top: 9px; }
.presets button { min-height: 44px; border: 1px solid #8296ac66; border-radius: 10px; background: #1a2836; font-size: 13px; font-weight: 800; }
.presets button.selected { border-color: #46e68c; background: #32ce6220; box-shadow: inset 0 0 0 1px #46e68c; }
.stake-error { margin: 8px 0 0; font-size: 11px; color: #ff9da7; line-height: 1.5; }
.quotes { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 10px; }
.quote { display: flex; flex-direction: column; gap: 2px; text-align: center; padding: 10px 10px 9px; border: 1px solid; border-top-width: 2px; border-radius: 12px; min-width: 0; }
.quote.home { border-color: #ed596977; border-top-color: #f15e6c; background: linear-gradient(135deg,#d8354920,#0a172015); }
.quote.away { border-color: #579afa77; border-top-color: #579afa; background: linear-gradient(135deg,#3668b320,#0a172015); }
.quote-top { display: flex; justify-content: space-between; align-items: center; gap: 5px; font-size: 10px; font-weight: 800; }
.home .quote-top { color: #ff9da7; }
.away .quote-top { color: #a4caff; }
.quote-rate { border: 1px solid currentColor; border-radius: 999px; padding: 2px 6px; font-size: 12px; }
.quote-return { margin-top: 4px; font-size: 32px; font-weight: 900; line-height: 1.2; font-variant-numeric: tabular-nums; }
.quote-caption { font-size: 11px; color: #afc2d4; }
.return-note { margin: 9px 0 0; color: #b3c3d3; font-size: 11px; text-align: center; }
.side-note { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 30px; color: #b6c8db; font-size: 11px; }
.fineprint summary { padding: 7px 14px; color: #c8d7e6; font-size: 12px; }
.fineprint p { padding: 0 14px 12px; margin: 0; font-size: 11px; line-height: 1.65; color: #b3c2d3; }
.fineprint b { color: #ecf2f9; }
.confirm-actions { flex: none; padding: 12px 18px 10px; background: #141f2c; border-top: 1px solid #8c9aae40; }
.btn-row { gap: 10px; }
.btn-row .btn { flex: 1.6; min-width: 0; border-radius: 12px; }
.btn-row .cancel { flex: 1; background: transparent; border: 1px solid #8196aa77; }
.confirm-actions p { margin: 8px 0 0; text-align: center; font-size: 10px; color: #aabdcf; }
button:focus-visible, summary:focus-visible, .slider:focus-visible { outline: 2px solid #76e9b1; outline-offset: 3px; }
@media (max-width: 350px) {
  .confirm-content { padding: 12px; gap: 9px; }
  .eyebrow { font-size: 9px; letter-spacing: .08em; }
  .vs { padding: 10px 7px; }
  .s-name { font-size: 12px; }
  .side :deep(.match-crest) { width: 36px; height: 40px; }
  .s-power { font-size: 11px; }
  .stake, .returns { padding: 11px; }
  .quote { padding: 9px 7px; }
  .quote-rate { font-size: 11px; padding: 2px 5px; }
  .quote-top { font-size: 8px; }
  .quote-return { font-size: 26px; }
  .lineups summary, .fineprint summary { padding-left: 11px; padding-right: 11px; }
  .disclosure-label small { font-size: 9px; margin-left: 5px; }
  .confirm-actions { padding: 11px 12px 10px; }
}
</style>
