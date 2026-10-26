<template>
  <div class="scroll pad rs">
    <div class="verdict" :class="matchView.won ? 'win' : 'lose'">
      {{ matchView.won ? 'YOU WIN' : 'YOU LOSE' }}
    </div>

    <div class="score card">
      <div class="sc">{{ matchView.homeScore }} : {{ matchView.awayScore }}</div>
      <div v-if="matchView.wentToPk" class="pk muted">
        after penalties {{ matchView.pkHome }} : {{ matchView.pkAway }}
      </div>
      <div class="names muted">{{ homeName }} vs {{ awayName }}</div>
    </div>

    <div class="money card">
      <div class="mrow"><span class="muted">Stake</span><span>₦{{ matchView.stake }}</span></div>
      <div class="mrow">
        <span class="muted">Your price ({{ matchView.aIsHome ? 'home' : 'away' }})</span>
        <span class="odds-cell r-cell">{{ matchView.myOdds.toFixed(2) }}</span>
      </div>
      <div class="mrow big">
        <span>{{ matchView.won ? 'Payout' : 'Lost' }}</span>
        <span :class="matchView.won ? 'green' : ''">
          ₦{{ matchView.won ? matchView.payout.toLocaleString() : matchView.stake }}
        </span>
      </div>
      <div v-if="matchView.won" class="fine muted">
        ₦{{ matchView.stake }} × {{ matchView.myOdds.toFixed(2) }} = {{ raw }} → floored to ₦{{ matchView.payout }}
      </div>
    </div>

    <div class="rank card">
      <div class="rk-head">
        <span>{{ rankLabel(store.rank.tierIndex, store.rank.subtier) }}</span>
        <span :class="matchView.rankDelta > 0 ? 'green' : 'red'">
          {{ matchView.rankDelta > 0 ? '+' : '' }}{{ matchView.rankDelta }}
        </span>
      </div>
      <div class="bar"><i :style="{ width: rankPct + '%' }"></i></div>
      <div class="rk-sub muted">{{ store.rank.score }} / {{ step }} to next tier</div>
    </div>

    <div v-for="p in matchView.promotions" :key="p.id" class="promo">
      <div class="pt">PROMOTED — {{ p.label }}</div>
      <div class="pr">
        <span v-if="p.reward.diamonds">◆ {{ p.reward.diamonds }}</span>
        <span v-if="p.reward.tickets">🎟 {{ p.reward.tickets }} jackpot tickets</span>
      </div>
    </div>

    <div class="scorers card" v-if="goals.length">
      <div class="sec-title" style="margin-bottom:8px">Goals</div>
      <div v-for="(g,i) in goals" :key="i" class="grow">
        <span>{{ g.minute }}'</span>
        <span>{{ g.actorName }}</span>
        <span class="muted">{{ g.side === 'HOME' ? homeName : awayName }}</span>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn" @click="home">Back home</button>
      <button class="btn btn-cta" @click="again">Play again</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store, go, ctx, matchView, abandonMatch, rankLabel } from '../game.js'
import { RANK_TIERS } from '../engine/economy.js'

const homeName = computed(() => matchView.aIsHome ? 'You' : matchView.opponentName)
const awayName = computed(() => matchView.aIsHome ? matchView.opponentName : 'You')
const raw = computed(() => (matchView.stake * matchView.myOdds).toFixed(2))
const step = computed(() => RANK_TIERS[store.rank.tierIndex].step || 100)
const rankPct = computed(() => Math.min(100, (store.rank.score / step.value) * 100))
const goals = computed(() => ctx.script ? ctx.script.events.filter(e => e.type === 'GOAL') : [])
function home () { abandonMatch(); go('home') }
function again () { abandonMatch(); go('tierselect') }
</script>

<style scoped>
.rs { display: flex; flex-direction: column; gap: 10px; }
.verdict { text-align: center; font-size: 26px; font-weight: 800; letter-spacing: .06em; padding: 6px 0; }
.verdict.win { color: var(--cta); }
.verdict.lose { color: var(--text-2); }
.score { text-align: center; padding: 14px; }
.sc { font-size: 34px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pk { font-size: 12px; margin-top: 2px; }
.names { font-size: 11px; margin-top: 6px; }
.money { padding: 4px 12px; }
.mrow { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--divider); font-size: 13px; }
.r-cell { padding: 3px 10px; font-size: 15px; }
.mrow.big { font-size: 17px; font-weight: 800; border-bottom: 0; }
.fine { font-size: 10px; padding-bottom: 10px; }
.rank { padding: 12px; }
.rk-head { display: flex; justify-content: space-between; font-weight: 700; font-size: 14px; }
.red { color: var(--red); }
.bar { height: 7px; background: var(--surface-hi); border-radius: 999px; overflow: hidden; margin: 8px 0 5px; }
.bar i { display: block; height: 100%; background: var(--green); }
.rk-sub { font-size: 11px; }
.promo { background: var(--cta-deep); border-radius: var(--r-md); padding: 12px; text-align: center; }
.pt { font-weight: 800; font-size: 13px; letter-spacing: .05em; }
.pr { display: flex; gap: 14px; justify-content: center; margin-top: 6px; font-size: 13px; font-weight: 700; }
.scorers { padding: 12px; }
.grow { display: flex; gap: 10px; font-size: 12px; padding: 5px 0; }
.grow span:nth-child(2) { flex: 1; font-weight: 700; }
</style>
