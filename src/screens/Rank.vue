<template>
  <div class="scroll pad rk">
    <div class="badge-wrap">
      <svg viewBox="0 0 100 112" class="hex">
        <polygon points="50,2 96,28 96,84 50,110 4,84 4,28"
                 :fill="tier.colour" fill-opacity=".18" :stroke="tier.colour" stroke-width="3" />
        <text x="50" y="52" text-anchor="middle" class="ht">{{ tier.name.slice(0,1) }}</text>
        <text x="50" y="74" text-anchor="middle" class="hs">{{ sub }}</text>
      </svg>
      <div class="tname">{{ rankLabel(store.rank.tierIndex, store.rank.subtier) }}</div>
      <div class="muted tsub">Current Tier</div>
    </div>

    <div class="prog card">
      <div class="prow"><span class="muted">Progress to next tier</span><span>{{ store.rank.score }} / {{ step }}</span></div>
      <div class="bar"><i :style="{ width: pct + '%' }"></i></div>
      <div class="muted fine">
        Every player gains about +5 per match on average, whatever their cards —
        the win bonus scales inversely with the odds.
      </div>
    </div>

    <div class="sec-title">Reward road</div>
    <div class="road">
      <div v-for="(n,i) in REWARD_ROAD" :key="n.id" class="node" :class="{ got: claimedIds.includes(n.id), big: n.big }">
        <div class="dot2">{{ claimedIds.includes(n.id) ? '✓' : (n.big ? '★' : '●') }}</div>
        <div class="nl">{{ n.label }}</div>
        <div class="nr">
          <span v-if="n.reward.diamonds">◆{{ n.reward.diamonds }}</span>
          <span v-if="n.reward.tickets">🎟{{ n.reward.tickets }}</span>
        </div>
      </div>
    </div>

    <div class="muted fine jack-note">
      Tickets come only from the reward road. They cannot be bought or traded.
      The draw algorithm is published.
    </div>

    <div class="stats card">
      <div class="srow"><span class="muted">Matches played</span><span>{{ store.stats.played }}</span></div>
      <div class="srow"><span class="muted">Wins</span><span>{{ store.stats.won }}</span></div>
      <div class="srow"><span class="muted">Won on penalties</span><span>{{ store.stats.pkWon }}</span></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { store, rankLabel, REWARD_ROAD } from '../game.js'
import { RANK_TIERS, SUBTIER_LABEL } from '../engine/economy.js'

const tier = computed(() => RANK_TIERS[store.rank.tierIndex])
const sub = computed(() => SUBTIER_LABEL[store.rank.subtier] || '')
const step = computed(() => tier.value.step || 100)
const pct = computed(() => Math.min(100, (store.rank.score / step.value) * 100))
const claimedIds = computed(() => store.rank.peakNodes || [])
</script>

<style scoped>
.rk { display: flex; flex-direction: column; gap: 12px; }
.badge-wrap { display: flex; flex-direction: column; align-items: center; gap: 2px; padding-top: 4px; }
.hex { width: 96px; }
.ht { font-size: 30px; font-weight: 800; fill: #fff; }
.hs { font-size: 15px; font-weight: 700; fill: var(--text-2); }
.tname { font-size: 17px; font-weight: 800; margin-top: 4px; }
.tsub { font-size: 11px; }
.prog { padding: 12px; }
.prow { display: flex; justify-content: space-between; font-size: 13px; }
.bar { height: 8px; background: var(--surface-hi); border-radius: 999px; overflow: hidden; margin: 8px 0 8px; }
.bar i { display: block; height: 100%; background: var(--green); }
.fine { font-size: 10px; line-height: 1.5; }
.road { display: flex; flex-direction: column; }
.node { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: var(--surface); border-bottom: 1px solid var(--divider); font-size: 12px; }
.node:first-child { border-radius: var(--r-md) var(--r-md) 0 0; }
.node:last-child { border-radius: 0 0 var(--r-md) var(--r-md); border-bottom: 0; }
.node.got { opacity: .55; }
.node.big { background: linear-gradient(90deg, var(--surface), #3A3320); }
.dot2 { width: 20px; text-align: center; color: var(--text-2); }
.node.got .dot2 { color: var(--cta); }
.node.big .dot2 { color: var(--r-l); }
.nl { flex: 1; }
.nr { display: flex; gap: 8px; font-weight: 700; }
.stats { padding: 12px; }
.jack-note { margin-top: -4px; }
.jrow, .srow { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
.jv { font-weight: 800; }
</style>
