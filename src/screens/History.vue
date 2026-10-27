<template>
  <div class="scroll pad hi">
    <template v-if="!detail">
      <div v-if="!store.history.length" class="empty muted">
        No matches yet. Your settled bets appear here, and every one can be
        played back.
      </div>

      <div v-for="m in store.history" :key="m.id" class="row card" @click="detail = m">
        <div class="r-badge" :class="m.won ? 'w' : 'l'">{{ m.won ? 'W' : 'L' }}</div>
        <div class="r-main">
          <div class="r-top">
            <span class="r-score">{{ m.homeScore }}:{{ m.awayScore }}</span>
            <span v-if="m.wentToPk" class="r-pk muted">PK {{ m.pk.home }}:{{ m.pk.away }}</span>
            <span class="r-opp muted">vs {{ m.opponent.handle }}</span>
          </div>
          <div class="r-sub muted">
            ₦{{ m.tierFee }} arena · {{ m.aIsHome ? 'home' : 'away' }} · {{ ago(m.at) }}
          </div>
        </div>
        <div class="r-right">
          <div class="r-net" :class="m.net >= 0 ? 'up' : 'down'">
            {{ m.net >= 0 ? '+' : '' }}₦{{ Math.abs(m.net).toLocaleString() }}
          </div>
          <div class="r-rank" :class="m.rankDelta >= 0 ? 'up' : 'down'">
            {{ m.rankDelta >= 0 ? '+' : '' }}{{ m.rankDelta }} rank
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <button class="back muted" @click="detail = null">‹ All matches</button>

      <div class="verdict" :class="detail.won ? 'win' : 'lose'">
        {{ detail.won ? 'WON' : 'LOST' }}
      </div>
      <div class="score card">
        <div class="sc">{{ detail.homeScore }} : {{ detail.awayScore }}</div>
        <div v-if="detail.wentToPk" class="muted pk">
          after penalties {{ detail.pk.home }} : {{ detail.pk.away }}
        </div>
        <div class="muted names">
          {{ detail.aIsHome ? 'You' : detail.opponent.handle }} vs
          {{ detail.aIsHome ? detail.opponent.handle : 'You' }}
        </div>
      </div>

      <div class="sec-title">Your squad that match</div>
      <div class="deck">
        <CardFace v-for="s in SLOTS" :key="s" :card="snapCard(detail.decks.you[s])"
                  size="sm" />
      </div>

      <div class="money card">
        <div class="mrow"><span class="muted">Arena</span><span>₦{{ detail.tierFee }}</span></div>
        <div class="mrow"><span class="muted">Stake</span><span>₦{{ detail.stake }}</span></div>
        <div class="mrow">
          <span class="muted">Toss</span>
          <span>{{ detail.aIsHome ? 'you were HOME' : 'you were AWAY' }}</span>
        </div>
        <div class="mrow">
          <span class="muted">Price settled at</span>
          <span class="odds-cell h-cell">{{ detail.odds.toFixed(2) }}</span>
        </div>
        <div class="mrow quoted muted">
          <span>quoted</span>
          <span>home {{ detail.oddsIfHome.toFixed(2) }} · away {{ detail.oddsIfAway.toFixed(2) }}</span>
        </div>
        <div class="mrow big">
          <span>{{ detail.won ? 'Payout' : 'Lost' }}</span>
          <span :class="detail.won ? 'green' : ''">
            ₦{{ detail.won ? detail.payout.toLocaleString() : detail.stake }}
          </span>
        </div>
        <div v-if="detail.won" class="fine muted">
          ₦{{ detail.stake }} × {{ detail.odds.toFixed(2) }} =
          {{ (detail.stake * detail.odds).toFixed(2) }} → floored to ₦{{ detail.payout }}
        </div>
        <div class="mrow">
          <span class="muted">Rank</span>
          <span :class="detail.rankDelta >= 0 ? 'green' : 'red'">
            {{ detail.rankDelta >= 0 ? '+' : '' }}{{ detail.rankDelta }}
          </span>
        </div>
      </div>

      <div v-for="p in detail.promotions" :key="p.id" class="promo">
        PROMOTED — {{ p.label }}
        <span v-if="p.reward.diamonds">· ◆{{ p.reward.diamonds }}</span>
        <span v-if="p.reward.tickets">· <Icon name="ticket" />{{ p.reward.tickets }}</span>
      </div>

      <button class="btn btn-cta" @click="startReplay(detail)">▶ Replay this match</button>
      <div class="replay-note muted">
        Replays the saved script — nothing is re-decided, re-paid or re-scored.
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import Icon from '../components/Icon.vue'
import CardFace from '../components/CardFace.vue'
import { store, BY_ID, startReplay } from '../game.js'
import { screenBack } from '../store.js'
import { buildCard } from '../engine/cards.js'

const SLOTS = ['gk', 'df', 'mf', 'fw']
const detail = ref(null)

function snapCard (s) { return buildCard(BY_ID[s.id], s.level) }

/* the top bar's back arrow leaves the detail view before it leaves the tab */
watch(detail, v => { screenBack.value = v ? () => { detail.value = null } : null }, { immediate: true })
onUnmounted(() => { screenBack.value = null })

function ago (t) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  const h = Math.round(m / 60)
  if (h < 24) return h + 'h ago'
  return Math.round(h / 24) + 'd ago'
}
</script>

<style scoped>
.hi { display: flex; flex-direction: column; gap: 8px; }
.empty { font-size: 12px; line-height: 1.5; padding: 20px 4px; text-align: center; }
.row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; }
.r-badge {
  width: 26px; height: 26px; flex: 0 0 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800;
}
.r-badge.w { background: var(--cta-deep); color: #fff; }
/* Hollow, not a solid red disc: a solid colour disc is the jersey shape, and
   the jersey red and the loss red are the same red (tokens.css). Shape is what
   separates them, so a loss gets an outline and a win keeps the solid fill. */
.r-badge.l {
  background: transparent; color: var(--loss);
  box-shadow: inset 0 0 0 1px var(--loss);
}
.r-main { flex: 1; min-width: 0; }
.r-top { display: flex; align-items: baseline; gap: 7px; }
.r-score { font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; }
.r-pk { font-size: 10px; }
.r-opp { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r-sub { font-size: 10px; margin-top: 2px; }
.r-right { text-align: right; }
.r-net { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
.r-net.up, .r-rank.up { color: var(--green); }
.r-net.down, .r-rank.down { color: var(--red); }
.r-rank { font-size: 10px; margin-top: 2px; }

.back { align-self: flex-start; font-size: 12px; padding: 15px 12px; margin: -12px -12px -15px; }
.verdict { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: .06em; }
.verdict.win { color: var(--cta); } .verdict.lose { color: var(--loss); }
.score { text-align: center; padding: 12px; }
.sc { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
.pk { font-size: 11px; margin-top: 2px; }
.names { font-size: 11px; margin-top: 5px; }
.deck { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.money { padding: 4px 12px; }
.mrow { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--divider); font-size: 13px; }
.mrow.quoted { border-bottom: 0; padding-top: 0; font-size: 10px; }
.mrow.big { font-size: 17px; font-weight: 800; }
.h-cell { padding: 3px 10px; font-size: 15px; }
.fine { font-size: 10px; padding-bottom: 8px; }
.red { color: var(--red); }
/* a record of a promotion, not a button — see base.css .banner-win */
.promo {
  background: linear-gradient(90deg, rgba(50,206,98,.18), rgba(50,206,98,.05));
  box-shadow: inset 3px 0 0 var(--cta);
  color: var(--cta);
  border-radius: var(--r-md); padding: 9px; text-align: center;
  font-size: 12px; font-weight: 700;
}
.replay-note { font-size: 10px; text-align: center; line-height: 1.5; }
</style>
