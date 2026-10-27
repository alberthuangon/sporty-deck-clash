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
        <!-- Rolls up from the STAKE, not from zero. The figure is readable in
             the first frame either way, and starting at the stake makes the
             roll mean something — this is what the money on the line became.
             A loss does not roll: the stake has not gone anywhere, and
             counting it up would be a flourish over bad news. -->
        <span :class="matchView.won ? 'green' : ''">
          <CountUp :value="matchView.won ? matchView.payout : matchView.stake"
                   :from="matchView.stake" prefix="₦" :animate="matchView.won" />
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

    <!-- Tappable, not automatic. The promotion and its reward are already
         readable right here; the takeover is the celebration, and a
         celebration that interrupts the ledger the player came to read is the
         same mistake as a PK light that comes on before the ball is kicked
         (§2.1). The jackpot draw was moved to "the player opens it" for this
         reason, so this follows it. -->
    <button v-for="p in matchView.promotions" :key="p.id" class="promo"
            data-sfx="rankup" @click="celebrate(p)">
      <span class="p-body">
        <span class="pt">PROMOTED — {{ p.label }}</span>
        <span class="pr">
          <span v-if="p.reward.diamonds">◆ {{ p.reward.diamonds }}</span>
          <span v-if="p.reward.tickets"><Icon name="ticket" /> {{ p.reward.tickets }} jackpot tickets</span>
        </span>
        <span class="ph">tap to celebrate</span>
      </span>
      <!-- a real element, not a pseudo one: "you can press this" is
           information, and the gate can only see what is really there -->
      <i class="p-go">&rsaquo;</i>
    </button>

    <div class="scorers card" v-if="goals.length">
      <div class="sec-title" style="margin-bottom:8px">Goals</div>
      <div v-for="(g,i) in goals" :key="i" class="goal-row" :class="g.side.toLowerCase()">
        <span class="g-min">{{ g.minute }}'</span>
        <span class="g-who">{{ g.actorName }}</span>
        <span class="g-team"><i class="g-jersey"></i>{{ g.side === 'HOME' ? homeName : awayName }}</span>
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
import Icon from '../components/Icon.vue'
import CountUp from '../components/CountUp.vue'
import { store, go, ctx, matchView, abandonMatch, rankLabel } from '../game.js'
import { RANK_TIERS } from '../engine/economy.js'

const homeName = computed(() => matchView.aIsHome ? 'You' : matchView.opponentName)
const awayName = computed(() => matchView.aIsHome ? matchView.opponentName : 'You')
const raw = computed(() => (matchView.stake * matchView.myOdds).toFixed(2))
const step = computed(() => RANK_TIERS[store.rank.tierIndex].step || 100)
const rankPct = computed(() => Math.min(100, (store.rank.score / step.value) * 100))
const goals = computed(() => ctx.script ? ctx.script.events.filter(e => e.type === 'GOAL') : [])
function celebrate (p) {
  store.rankUpView = { label: p.label, reward: p.reward }
  store.overlay = 'rankup'
}
function home () { abandonMatch(); go('home') }
function again () { abandonMatch(); go('tierselect') }
</script>

<style scoped>
.rs { display: flex; flex-direction: column; gap: 10px; }
.verdict { text-align: center; font-size: 26px; font-weight: 800; letter-spacing: .06em; padding: 6px 0; }
.verdict.win { color: var(--cta); }
/* A loss painted in the same grey as .muted reads as "nothing happened". */
.verdict.lose { color: var(--loss); }
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
/* Still a button — it says TAP TO CELEBRATE and removing the affordance
   would be worse than the problem. But a screen gets one solid mint button,
   and that one is Play again, so this keeps the colour and loses the fill.
   The 1px inner ring is what says "pressable" alongside the label; no arrow
   pseudo-element, because "you can tap this" is information and information
   belongs in a real element. */
.promo {
  background: linear-gradient(90deg, rgba(50,206,98,.20), rgba(50,206,98,.07));
  box-shadow: inset 3px 0 0 var(--cta), inset 0 0 0 1px rgba(50,206,98,.35);
  color: var(--cta);
  border-radius: var(--r-md); padding: 12px; text-align: left;
  width: 100%; min-height: 44px;
  display: flex; align-items: center; gap: 10px;
}
.p-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.p-go {
  flex: none; width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 800; font-style: normal; line-height: 1;
  color: var(--cta); box-shadow: inset 0 0 0 1px rgba(50,206,98,.5);
}
.pt { font-weight: 800; font-size: 13px; letter-spacing: .05em; }
.pr { display: flex; gap: 14px; margin-top: 6px; font-size: 13px; font-weight: 700; }
.ph { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; opacity: .75; margin-top: 7px; }
</style>
