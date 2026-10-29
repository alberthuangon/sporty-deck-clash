<template>
  <div class="rs" :class="{ 'result-won': matchView.won }">
    <div class="result-content scroll">
    <div class="result-label">MATCH COMPLETE</div>
    <h1 class="verdict" :class="matchView.won ? 'win' : 'lose'">
      {{ matchView.won ? 'YOU WIN' : 'YOU LOSE' }}
    </h1>

    <div class="score card"><div class="result-teams"><div><MatchCrest label="H" tone="home" /><span>{{ homeName }}</span></div><span class="score-label">FULL TIME</span><div><MatchCrest label="A" tone="away" /><span>{{ awayName }}</span></div></div>
      <div class="sc">{{ matchView.homeScore }} : {{ matchView.awayScore }}</div>
      <div v-if="matchView.wentToPk" class="pk muted">
        after penalties {{ matchView.pkHome }} : {{ matchView.pkAway }}
      </div>

    </div>

    <div class="money card"><div class="ledger-title">MATCH SETTLEMENT</div>
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

    <div class="rank card"><div class="ledger-title">YOUR RANK PROGRESS</div>
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
          <span v-if="p.reward.diamonds"><DiamondIcon :size="19" /> {{ p.reward.diamonds }}</span>
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

    </div>
    <div class="btn-row">
      <button class="btn" @click="home">Back home</button>
      <button class="btn btn-cta" @click="again">Play again</button>
    </div>
  </div>
</template>

<script setup>
import MatchCrest from '../components/MatchCrest.vue'
import DiamondIcon from '../components/DiamondIcon.vue'
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
function again () {
  const tierFee = matchView.tierFee
  abandonMatch()
  store.pendingTier = tierFee
  go('matchmaking')
}
</script>

<style scoped>
.rs {
  display:flex;
  flex-direction:column;
  gap:14px;
  padding:25px 18px 20px;
  background:linear-gradient(180deg,#111b27ad,#10151e 380px),url('../assets/shop-art/stadium.webp') center top/auto 380px no-repeat,#10151e;
}
.result-label {
  text-align:center;
  color:#aabccc;
  font-weight:800;
  letter-spacing:.2em;
  font-size:9px;
}
.verdict {
  text-align:center;
  font-size:35px;
  line-height:1.1;
  font-weight:900;
  letter-spacing:-.035em;
}
.verdict.win {
  color:#63e99a;
  text-shadow:0 0 35px #32ce6240;
}
.verdict.lose {
  color:var(--loss);
}
.score {
  padding:15px 16px 19px;
  text-align:center;
  background:linear-gradient(135deg,#273340d9,#17222de6);
  border:1px solid #91a6b43b;
  border-radius:17px;
}
.result-teams {
  display:flex;
  align-items:center;
  justify-content:space-around;
  gap:6px;
}
.result-teams>div {
  width:100px;
  min-width:0;
  display:flex;
  align-items:center;
  flex-direction:column;
  gap:7px;
  font-weight:700;
  font-size:12px;
}
.result-teams>div>span {
  max-width:100%;
  overflow-wrap:anywhere;
}
.score-label {
  font-size:9px;
  letter-spacing:.14em;
  color:#a7b7c8;
  flex:none;
}
.sc {
  font-size:45px;
  font-weight:900;
  letter-spacing:.04em;
  font-variant-numeric:tabular-nums;
  margin-top:5px;
}
.pk {
  font-size:11px;
  color:#d9c284;
}
.ledger-title {
  font-size:9px;
  font-weight:800;
  letter-spacing:.13em;
  color:#a7bdcb;
  margin-bottom:8px;
}
.money {
  padding:15px 16px;
  background:linear-gradient(130deg,#253239,#1b2530);
  border:1px solid #839aa32c;
  border-radius:15px;
}
.result-won .money {
  border-color:#5bce8e50;
}
.mrow {
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  padding:10px 0;
  border-bottom:1px solid #ffffff10;
  font-size:12px;
}
.r-cell {
  padding:3px 12px;
  font-size:16px;
}
.mrow.big {
  border:0;
  font-size:16px;
  font-weight:800;
  padding:14px 0 8px;
}
.mrow.big>span:last-child {
  font-size:27px;
  font-variant-numeric:tabular-nums;
}
.fine {
  font-size:10px;
  line-height:1.6;
  padding:0 0 3px;
}
.rank {
  padding:16px;
  background:#1e2934;
  border:1px solid #91a6b42b;
  border-radius:14px;
}
.rk-head {
  display:flex;
  justify-content:space-between;
  font-weight:800;
  font-size:14px;
}
.red {
  color:var(--red);
}
.bar {
  height:7px;
  background:#080e1680;
  border-radius:999px;
  overflow:hidden;
  margin:12px 0 7px;
}
.bar i {
  display:block;
  height:100%;
  background:linear-gradient(90deg,#25995a,#63e99a);
  border-radius:inherit;
}
.rk-sub {
  font-size:10px;
}
.promo {
  display:flex;
  align-items:center;
  gap:10px;
  width:100%;
  min-height:64px;
  padding:14px;
  border-radius:14px;
  background:linear-gradient(120deg,#32ce6222,#32ce6208);
  box-shadow:inset 0 0 0 1px #32ce6266;
  color:#7cedad;
  text-align:left;
}
.p-body {
  flex:1;
  min-width:0;
  display:flex;
  flex-direction:column;
}
.pt {
  font-size:12px;
  font-weight:800;
  letter-spacing:.03em;
}
.pr {
  display:flex;
  gap:14px;
  margin-top:6px;
  font-size:12px;
  font-weight:700;
}
.pr>span {
  display:flex;
  align-items:center;
  gap:5px;
}
.ph {
  font-size:9px;
  letter-spacing:.08em;
  text-transform:uppercase;
  opacity:.8;
  margin-top:7px;
}
.p-go {
  font-style:normal;
  font-size:24px;
}
.scorers {
  padding:14px;
  background:#1b2530;
  border:1px solid #91a6b425;
  border-radius:14px;
}
.goal-row {
  display:flex;
  align-items:center;
  gap:8px;
  font-size:11px;
  padding:8px 0;
  border-top:1px solid #ffffff0b;
}
.g-min {
  width:28px;
  color:#a8b8c8;
  font-variant-numeric:tabular-nums;
}
.g-who {
  flex:1;
  font-weight:700;
}
.g-team {
  display:flex;
  align-items:center;
  gap:5px;
  font-size:10px;
  max-width:40%;
  color:#a8b8c8;
}
.g-jersey {
  width:7px;
  height:9px;
  border-radius:2px;
  flex:none;
}
.home .g-jersey {
  background:var(--home);
}
.away .g-jersey {
  background:var(--away);
}
.btn-row {
  margin-top:auto;
}
.btn-row .btn {
  flex: 1;
  min-width: 0;
  border-radius:12px;
}
.btn-row .btn:first-child {
  background:transparent;
  border:1px solid #71849677;
}
@media(max-width:350px) {
  .rs {
    padding:20px 12px;
    gap:12px;
  }
  .score-label {
    font-size:8px;
  }
  .mrow.big>span:last-child {
    font-size:24px;
  }
  .result-teams :deep(.match-crest) {
    width:47px;
    height:54px;
  }
}
.rs {
  padding:0;
  gap:0;
}
.result-content {
  display:flex;
  flex-direction:column;
  gap:14px;
  min-height:0;
  padding:25px 18px 20px;
  scrollbar-width:none;
}
.result-content::-webkit-scrollbar {
  display:none;
}
.result-content>* {
  flex-shrink:0;
}
.rs>.btn-row {
  flex:none;
  margin:0;
  padding:14px 18px 18px;
  background:#141e2b;
  border-top:1px solid #8c9aae22;
}
@media(max-width:350px) {
  .rs {
    padding:0;
  }
  .result-content {
    padding:20px 12px;
    gap:12px;
  }
  .rs>.btn-row {
    padding-left:12px;
    padding-right:12px;
  }
}
</style>
