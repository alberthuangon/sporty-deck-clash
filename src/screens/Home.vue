<template>
  <div class="scroll pad hm">
    <div class="squad card-hero">
      <div class="sq-head">
        <span class="sec-title" style="margin:0">Your squad</span>
        <!-- padded to a real target and pulled back with margin so the row
             does not grow around it, the same trick the collection's old
             back link used. Text rather than a glyph because this icon set
             has no pencil, and "All ›" in the Recent header already
             established the arrow as this screen's "go somewhere" mark. -->
        <button class="sq-edit" @click="go('deckedit')">Edit ›</button>
      </div>
      <div class="lineup">
        <div v-for="s in SLOTS" :key="s.key" class="lu">
          <div class="lu-lbl">{{ s.short }}</div>
          <CardFace :card="cardOf(store.deck[s.key])" size="sm" full />
        </div>
      </div>
    </div>

    <!-- THE CHOICE COMES FIRST, and the button below reports it. -->
    <div class="arenas">
      <div class="sec-title" style="margin-bottom:8px">Arenas</div>
      <div class="arena-row">
        <div v-for="(t, i) in TIERS" :key="t.id" class="arena" :class="[`tier-${i}`,
             { locked: !unlocked(t), sel: chosen === t.fee }]" @click="choose(t)">
          <div class="a-fee">₦{{ t.fee }}</div>
          <div class="a-name">{{ t.name }}</div>
          <!-- WHAT THE ARENA ACTUALLY DECIDES. Not a win figure: a payout is
               stake x odds and the odds come from the matchup's own win
               probability, so there is no winnings number that belongs to an
               arena rather than to an opponent. The stake range is the thing
               this choice really sets, and it comes from stakeRange(). -->
          <!-- ONE SLOT, two contents, a fixed height. Three cards side by
               side whose insides are different heights is what `grid cells
               whose contents are ragged` is for, and it caught exactly that:
               53.7 unlocked against 75.5 locked against 90.3 selected. The
               same answer the card face already uses for its venue mark and
               the reveal already uses for its "final card" line — the element
               is always there, and empty when it has nothing to say. -->
          <div class="a-detail">
            <template v-if="unlocked(t)">
              <span class="a-stake">₦{{ range(t).min }}–₦{{ range(t).max }}</span>
            </template>
            <template v-else>
              <span class="a-need"><Icon name="lock" /> {{ ladderLabel(t.unlockRank) }}</span>
              <span class="a-have">you are {{ myRank }}</span>
            </template>
          </div>
          <div class="a-sel">{{ chosen === t.fee ? 'SELECTED' : '' }}</div>
        </div>
      </div>
    </div>

    <!-- disabled says WHY, because a grey button with its usual label is a
         button that looks broken rather than one that is waiting -->
    <button class="btn btn-cta big" :disabled="!chosen" data-sfx="start" @click="start">
      {{ chosen ? `START MATCH · ₦${chosen}` : 'Choose an arena to start' }}
    </button>

    <div class="recent card" v-if="store.history.length">
      <div class="rc-head">
        <span class="sec-title" style="margin:0">Recent matches</span>
        <button class="rc-all" @click="go('history')">All ›</button>
      </div>
      <div v-for="m in store.history.slice(0, 3)" :key="m.id" class="rc-row" @click="go('history')">
        <i class="rc-dot" :class="m.won ? 'w' : 'l'"></i>
        <span class="rc-sc">{{ m.homeScore }}:{{ m.awayScore }}</span>
        <span class="rc-opp muted">{{ m.opponent.handle }}</span>
        <span class="rc-net" :class="m.net >= 0 ? 'up' : 'down'">
          {{ m.net >= 0 ? '+' : '' }}₦{{ Math.abs(m.net).toLocaleString() }}
        </span>
      </div>
    </div>

    <JackpotPanel @last-season="showLastSeason" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import CardFace from '../components/CardFace.vue'
import JackpotPanel from '../components/JackpotPanel.vue'
import { store, go, cardOf, TIERS, stakeRange, tierUnlocked, ladderLabel, rankLabel, openLastSeasonDraw } from '../game.js'

const SLOTS = [
  { key: 'gk', short: 'GK' }, { key: 'df', short: 'DF' },
  { key: 'mf', short: 'MF' }, { key: 'fw', short: 'FW' }
]
/* The arenas are gated on RANK now (see the note on TIERS in economy.js).
   The Squad Power stars that used to sit in the top-left were deckPower()
   and never had anything to do with the gate — the old gate was
   collectionPower() — so removing them loses a number, it does not move one.
   What moves into the lock line is the player's rank, which IS the thing
   being compared, written with the same ladderLabel the requirement uses. */
const myRank = computed(() => rankLabel(store.rank.tierIndex, store.rank.subtier))
const chosen = computed(() => store.pendingTier)

/* Demo: the season draw happens at season end, which nobody reaches in a
   pitch. This is the way in — sealed until opened, then a record of what
   happened. */
function showLastSeason () { openLastSeasonDraw() }
function unlocked (t) { return tierUnlocked(t) }
function range (t) { return stakeRange(t.fee) }
function choose (t) { if (unlocked(t)) store.pendingTier = t.fee }
/* straight to matchmaking: the arena that screen was for is chosen here now */
function start () { if (chosen.value) go('matchmaking') }
</script>

<style scoped>
.hm { display: flex; flex-direction: column; gap: 12px; }
.lbl { font-size: 11px; }
.squad { padding: 12px; }
.sq-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
/* padded to a real 44px target and pulled back with margin, so making it
   tappable costs the header row no height */
.sq-edit {
  font-size: 13px; font-weight: 700; color: var(--cta);
  line-height: 18px; padding: 13px 10px; margin: -13px -10px;
}
.lineup { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.lu { display: flex; flex-direction: column; gap: 3px; }
.lu-lbl { font-size: 9px; font-weight: 800; color: var(--text-3); letter-spacing: .06em; text-align: center; }

/* THREE CARDS, one row, because the choice is a comparison: entry, stake and
   whether it is open are all things you read ACROSS the options rather than
   down one of them. */
.arena-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.arena {
  position: relative; cursor: pointer;
  background: var(--surface); border: 1px solid var(--divider);
  border-radius: var(--r-md); padding: 10px 8px 9px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  min-height: 86px; justify-content: center;
}
/* NO TIER COLOUR BAR. The first cut gave each arena an accent stripe copied
   from TierSelect's ramp — grey, green, gold — and on THIS screen green
   already has a job: it is what a chosen arena wears. A locked Home Arena
   with a green bar on it reads as the selected one. The fee is 16px and bold
   and distinguishes the three on its own, so the stripe was spending a
   semantic colour to repeat something already said. Green is left to mean
   exactly one thing here: this is the arena you are about to play. */
.a-fee { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
.a-name { font-size: 10px; font-weight: 700; color: var(--text-2); text-align: center; line-height: 1.2; }
.a-detail {
  min-height: 26px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px;
}
.a-stake { font-size: 9px; color: var(--text-3); font-variant-numeric: tabular-nums; }
/* SELECTED is mint and so is the chosen frame: this product's green means
   "the thing you are about to do", which is exactly what a chosen arena is */
.arena.sel { border-color: var(--cta); box-shadow: 0 0 0 1px var(--cta), 0 0 14px rgba(51,234,106,.28); }
.a-sel { font-size: 8px; font-weight: 800; letter-spacing: .08em; color: var(--cta); min-height: 10px; line-height: 10px; }
.arena.locked { opacity: .72; cursor: default; border-style: dashed; }
.a-need { font-size: 9px; font-weight: 800; color: var(--text-2); display: flex; align-items: center; gap: 2px; }
.a-have { font-size: 8px; color: var(--text-3); }
.big { width: 100%; }
.big:disabled { opacity: 1; background: var(--surface-hi); color: var(--text-3); box-shadow: none; }

.recent { padding: 12px; }
.rc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.rc-all { font-size: 11px; color: var(--green); font-weight: 700; padding: 16px 13px; margin: -16px -13px; }
.rc-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 12px; cursor: pointer; }
.rc-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 7px; }
.rc-dot.w { background: var(--cta); } .rc-dot.l { background: var(--text-3); }
.rc-sc { font-weight: 700; font-variant-numeric: tabular-nums; width: 30px; }
.rc-opp { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-net { font-weight: 700; font-variant-numeric: tabular-nums; }
.rc-net.up { color: var(--green); } .rc-net.down { color: var(--red); }
</style>
