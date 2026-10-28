<template>
  <div class="scroll rk">
    <section class="rank-hero" aria-label="Current rank">
      <p class="eyebrow">Current tier</p>
      <RankCrest :tier="store.rank.tierIndex" :sub="store.rank.subtier" hero />
      <h1>{{ currentLabel }}</h1>
      <div v-if="nextLabel" class="progress-block">
        <div class="progress-labels"><span>{{ currentLabel }}</span><strong>{{ store.rank.score }} / {{ tier.step }} <small>RP</small></strong><span>{{ nextLabel }}</span></div>
        <div class="rank-track" role="progressbar" aria-label="Progress to next rank" :aria-valuenow="store.rank.score" :aria-valuemin="0" :aria-valuemax="tier.step"><i :style="{ width: pct + '%' }" /></div>
        <p class="remaining"><strong>{{ tier.step - store.rank.score }} RP</strong> to {{ nextLabel }}</p>
      </div>
      <div v-else class="champion-score"><strong>{{ store.rank.score }} RP</strong><p>Champion reached. Keep building your score.</p></div>
    </section>
    <div class="rank-body">
      <section v-if="nextReward" class="next-reward" aria-label="Next reward">
        <span class="reward-token" :class="nextReward.reward.tickets ? 'ticket-token' : 'diamond-token'" aria-hidden="true"><Icon v-if="nextReward.reward.tickets" name="ticket" :size="32" /><DiamondIcon v-else :size="36" /></span>
        <div><p class="eyebrow">Next reward</p><h2>{{ rewardText(nextReward.reward) }}</h2><p class="reach">Reach {{ nextReward.label }}</p></div>
        <span class="reward-star" aria-hidden="true">✦</span>
      </section>
      <section v-else class="road-complete"><span aria-hidden="true">✓</span><div><h2>Reward road complete</h2><p>Every milestone reward earned this season.</p></div></section>
      <section class="reward-section" aria-labelledby="road-heading">
        <h2 id="road-heading">Reward road</h2><p class="section-sub">Your climb. Your rewards.</p>
        <ol class="road">
          <li v-for="(node, i) in road" :key="node.id" class="road-node" :class="{ earned: claimedIds.includes(node.id), upcoming: node.id === nextReward?.id, milestone: node.big }" :style="{ '--node-colour': RANK_TIERS[node.tier].colour }">
            <span class="road-group" v-if="i === 0 || node.tier !== road[i - 1].tier">{{ RANK_TIERS[node.tier].name }}</span>
            <span class="road-dot" aria-hidden="true">{{ claimedIds.includes(node.id) ? '✓' : '' }}</span>
            <div class="node-card">
              <RankCrest :tier="node.tier" :sub="node.sub" />
              <div class="node-name"><strong>{{ node.label }}</strong><span class="node-status" :class="{ 'next-pill': node.id === nextReward?.id }">{{ claimedIds.includes(node.id) ? 'Earned' : node.id === nextReward?.id ? 'Next' : '' }}</span></div>
              <div class="node-rewards">
                <span v-if="node.reward.diamonds"><DiamondIcon :size="21" class="diamond-icon" /><span>{{ node.reward.diamonds }}<small> Diamonds</small></span></span>
                <span v-if="node.reward.tickets"><Icon name="ticket" :size="20" class="ticket-icon" /><span>{{ node.reward.tickets }}<small> Draw Tickets</small></span></span>
              </div>
            </div>
          </li>
        </ol>
        <p class="ticket-note"><span aria-hidden="true">ⓘ</span> Tickets are earned on the road, never bought or traded. The draw algorithm is published.</p>
      </section>
      <details class="rank-help">
        <summary><span class="info-symbol" aria-hidden="true">i</span>How rank points work<span class="help-chevron" aria-hidden="true">⌄</span></summary>
        <div class="help-copy"><p>Every player gains about +5 RP per match on average, whatever their cards. The win bonus scales inversely with the odds; a loss costs 20 RP.</p><p>You can drop a subdivision, but never below your current major tier. Milestone rewards are awarded automatically, once per season.</p></div>
      </details>
      <section class="rank-record" aria-labelledby="record-heading">
        <h2 id="record-heading">Your record</h2>
        <div class="record-grid"><div><strong>{{ store.stats.played }}</strong><span>Matches played</span></div><div><strong>{{ store.stats.won }}</strong><span>Wins</span></div><div><strong>{{ store.stats.pkWon }}</strong><span>Penalty wins</span></div></div>
      </section>
    </div>
  </div>
</template>
<script setup>
import DiamondIcon from '../components/DiamondIcon.vue'
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import RankCrest from '../components/RankCrest.vue'
import { store, rankLabel, REWARD_ROAD } from '../game.js'
import { RANK_TIERS, ladderIndex } from '../engine/economy.js'
const tier = computed(() => RANK_TIERS[store.rank.tierIndex])
const currentLabel = computed(() => rankLabel(store.rank.tierIndex, store.rank.subtier))
const position = computed(() => ladderIndex(store.rank.tierIndex, store.rank.subtier))
const nextLabel = computed(() => tier.value.step === null ? null : rankLabel(store.rank.tierIndex + (store.rank.subtier === 1 ? 1 : 0), store.rank.subtier === 1 ? 3 : store.rank.subtier - 1))
const pct = computed(() => tier.value.step ? Math.max(0, Math.min(100, store.rank.score / tier.value.step * 100)) : 100)
const claimedIds = computed(() => store.rank.peakNodes || [])
const nextReward = computed(() => REWARD_ROAD.find((node, i) => i >= position.value && !claimedIds.value.includes(node.id)))
const road = REWARD_ROAD.map((node, i) => ({ ...node, tier: Math.floor((i + 1) / 3), sub: 3 - ((i + 1) % 3) }))
function rewardText (reward) {
  return [reward.diamonds ? `${reward.diamonds} Diamonds` : '', reward.tickets ? `${reward.tickets} Draw Tickets` : ''].filter(Boolean).join(' + ')
}
</script>
<style scoped>
.rk { background: #191e25; scrollbar-width: thin; scrollbar-color: #505966 transparent; }
.rk::-webkit-scrollbar { width: 4px; }
.rk::-webkit-scrollbar-thumb { background: #505966; border-radius: 4px; }
.rk::-webkit-scrollbar-track { background: transparent; }
.rk > * { flex-shrink: 0; }
.rank-hero { position: relative; display: flex; flex-direction: column; align-items: center; padding: 20px 18px 18px; isolation: isolate; }
.rank-hero::before { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, #0f141b12, #191e250d 55%, #191e25 100%), url('../assets/rank-art/stadium.webp') center top / cover; }
.eyebrow { margin: 0; font-size: 10px; font-weight: 700; letter-spacing: .22em; text-transform: uppercase; color: #b7bec8; }
.rank-hero h1 { font-size: 28px; letter-spacing: -.035em; margin-top: -2px; text-shadow: 0 2px 15px #000; }
.progress-block { width: 100%; margin-top: 20px; }
.progress-labels { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; color: #bdc4cd; }
.progress-labels strong { color: #fff; font-size: 16px; font-variant-numeric: tabular-nums; }
.progress-labels small { font-size: 10px; color: #bdc4cd; }
.rank-track { height: 8px; border-radius: 20px; background: #363e49; overflow: hidden; margin-top: 9px; }
.rank-track i { display: block; height: 100%; background: linear-gradient(90deg, #27c96a, #53ee8a); border-radius: inherit; }
.remaining { font-size: 12px; color: #b7bec8; margin: 9px 0 0; text-align: center; }
.remaining strong { color: #f1f5f8; font-weight: 600; }
.rank-body { padding: 0 16px 22px; }
.next-reward { display: flex; align-items: center; gap: 14px; padding: 15px; min-height: 88px; border: 1px solid #9c783c; border-radius: 10px; background: radial-gradient(ellipse at 0 50%, #51402388, transparent 75%), linear-gradient(120deg, #292923, #20252d); }
.next-reward .eyebrow { font-size: 9px; color: #d3bb91; }
.next-reward h2 { font-size: 18px; margin-top: 4px; line-height: 1.2; }
.reach { font-size: 12px; color: #bfc1c5; margin: 4px 0 0; }
.reward-token { width: 58px; height: 41px; flex: none; display: flex; align-items: center; justify-content: center; transform: rotate(-12deg); }
.ticket-token { border: 2px solid #ffda7a; outline: 1px solid #91621d; outline-offset: 2px; border-radius: 5px; color: #63400e; background: linear-gradient(135deg,#fff0b0,#e6a72f 60%,#ffda76); box-shadow: 0 5px 15px #0006; }
.diamond-token { color: var(--diamond); filter: drop-shadow(0 3px 8px #40c9ff66); }
.reward-star { color: #e9bc69; font-size: 23px; margin-left: auto; }
.reward-section { margin-top: 22px; }
.reward-section h2 { text-transform: uppercase; font-size: 19px; letter-spacing: -.02em; }
.section-sub { color: #b3bbc7; font-size: 12px; margin: 3px 0 17px; }
.road { margin: 0; padding: 0; }
.road-node { position: relative; padding-left: 64px; padding-bottom: 7px; min-height: 55px; }
.road-node::before { content: ''; position: absolute; left: 55px; top: 0; bottom: 0; width: 2px; background: #59616c; }
.road-node:first-child::before { top: 24px; }
.road-node:last-child::before { height: 24px; }
.road-group { position: absolute; left: 0; top: 21px; font-size: 9px; font-weight: 800; text-transform: uppercase; color: var(--node-colour); letter-spacing: .02em; }
.road-dot { position: absolute; left: 51px; top: 20px; width: 10px; height: 10px; border-radius: 50%; background: var(--node-colour); z-index: 1; font-size: 8px; color: #10231a; display: flex; align-items: center; justify-content: center; }
.upcoming .road-dot { background: #173c27; border: 3px solid #51e786; }
.earned .road-dot { background: #55d88b; }
.node-card { min-height: 50px; padding: 5px 9px 5px 5px; display: flex; align-items: center; gap: 6px; border-radius: 7px; background: linear-gradient(110deg, #2a3039, #232931); box-shadow: inset 0 0 0 1px #ffffff03; }
.milestone .node-card { background: linear-gradient(110deg, color-mix(in srgb, var(--node-colour) 12%, #242a32), #232931); }
.upcoming .node-card { box-shadow: inset 0 0 0 1px #58d77f; background: linear-gradient(110deg,#233c2e,#232931); }
.node-name { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; }
.node-name strong { font-size: 11px; white-space: nowrap; }
.node-status { min-height: 13px; line-height: 13px; font-size: 9px; color: #8dcda6; }
.next-pill { color: #092410; background: #51e786; font-size: 8px; font-weight: 800; line-height: 13px; border-radius: 3px; text-transform: uppercase; padding: 0 4px; letter-spacing: .05em; }
.node-rewards { display: flex; flex-direction: column; gap: 3px; margin-left: auto; }
.node-rewards > span { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.node-rewards small { font-size: 9px; font-weight: 400; color: #c1c7cf; }
.diamond-icon { color: #6ee7ff; filter: drop-shadow(0 1px 3px #3ca7ce55); }
.ticket-icon { color: #f5c35e; }
.ticket-note { display: flex; gap: 7px; color: #adb6c2; font-size: 10px; line-height: 1.6; margin: 9px 0 17px; }
.ticket-note > span { font-size: 16px; flex: none; }
.rank-help { background: linear-gradient(130deg,#2a3039,#232931); border-radius: 8px; box-shadow: inset 0 0 0 1px #ffffff09; }
.rank-help summary { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 10px 12px; cursor: pointer; font-weight: 600; font-size: 12px; list-style: none; }
.rank-help summary::-webkit-details-marker { display: none; }
.rank-help summary:focus-visible { outline: 2px solid #53e78a; outline-offset: 2px; border-radius: 8px; }
.info-symbol { border: 1.5px solid #aeb9c9; color: #aeb9c9; width: 17px; height: 17px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font: 600 12px Georgia,serif; }
.help-chevron { margin-left: auto; color: #b4bdca; font-size: 19px; }
details[open] .help-chevron { transform: rotate(180deg); }
.help-copy { padding: 0 13px 12px; color: #c1c7d0; font-size: 11px; line-height: 1.65; }
.help-copy p { margin: 0 0 6px; }
.rank-record { margin-top: 12px; padding: 13px 12px 17px; border-radius: 9px; background: linear-gradient(130deg,#2a3039,#232931); box-shadow: inset 0 0 0 1px #ffffff09; }
.rank-record h2 { color: #b3bbc8; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
.record-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); margin-top: 11px; }
.record-grid > div { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.record-grid > div + div { border-left: 1px solid #49505b; }
.record-grid strong { font-size: 25px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.record-grid span { color: #b6bfcd; font-size: 10px; }
.champion-score { text-align: center; margin-top: 15px; }
.champion-score strong { font-size: 23px; color: #ffb8aa; }
.champion-score p { color: #c0c6d0; font-size: 12px; }
.road-complete { display: flex; gap: 12px; padding: 16px; background: #20362b; border: 1px solid #518668; border-radius: 9px; }
.road-complete > span { color: #7ae29b; font-size: 24px; }
.road-complete h2 { font-size: 15px; }
.road-complete p { font-size: 11px; color: #c3cfca; margin: 5px 0 0; }
@media (max-width: 370px) { .rank-body { padding-left: 12px; padding-right: 12px; } .road-node { padding-left: 57px; } .road-node::before { left: 48px; } .road-dot { left: 44px; } .road-group { font-size: 8px; } .node-rewards small { display: none; } .progress-labels { font-size: 10px; } .progress-labels strong { font-size: 14px; } }
</style>
