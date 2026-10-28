<template>
  <div class="up">
    <div class="scroll up-content">
      <template v-if="!target">
        <section class="no-card"><Icon name="cards" :size="48" :stroke="1.3" /><h1>Choose a card to upgrade</h1><p>Open your collection and select an owned player.</p><button class="btn btn-cta" @click="go('cards')">Open collection</button></section>
      </template>
      <template v-else>
        <section class="head" aria-label="Player upgrade summary">
          <CardFace :card="now" size="md" :radar="false" full class="mini" />
          <div class="hinfo">
            <div class="upgrade-badges"><span class="rarity" :class="'r-' + now.rarity">{{ RARITY[now.rarity].label }}</span><span class="squad-badge" :class="{ selected: inDeck }">{{ inDeck ? 'In squad' : 'Owned' }}</span></div>
            <h1 class="hn">{{ now.name }}</h1><p class="role">{{ ROLE_LABEL[BY_ID[target].role] }}</p>
            <div class="hl"><span>Lv.{{ now.level }}</span><template v-if="next"><span class="level-arrow" aria-hidden="true">→</span><strong>Lv.{{ next.level }}</strong></template><span v-else class="max-tag">Max level</span></div>
            <div class="total"><span>Total points</span><strong>{{ now.total }}</strong><template v-if="next"><span aria-hidden="true">→</span><strong class="gain-text">{{ next.total }}</strong><span class="gain-pill">+{{ next.total - now.total }}</span></template></div>
          </div>
        </section>
        <div class="upgrade-body">
          <section v-if="receipt" class="done-banner" role="status" aria-live="polite"><span class="done-check" aria-hidden="true">✓</span><div><h2>Upgraded to Lv.{{ receipt.level }}</h2><p>{{ receipt.spent }} shard{{ receipt.spent === 1 ? '' : 's' }} used. Your player is ready.</p></div><button v-if="!inDeck" class="add-squad" @click="go('deckedit')">Add to squad <span aria-hidden="true">›</span></button></section>
          <section class="radwrap panel" :class="'r-' + now.rarity" aria-labelledby="preview-heading">
            <div class="panel-head"><h2 id="preview-heading">{{ next ? 'Upgrade preview' : 'Player attributes' }}</h2><p>{{ next ? 'See what improves' : 'This player has reached max level' }}</p></div>
            <RadarChart ref="radarRef" :axis-keys="now.axisKeys" :values="now.axes" :ghost="next ? next.axes : null" :deltas="next ? delta : null" :size="244" labels role="img" :aria-label="chartSummary" />
            <div class="legend"><span><i class="sw solid"></i>Current</span><span v-if="next"><i class="sw dash"></i>Next level</span></div>
            <dl class="axis-key"><div v-for="axis in now.axisKeys" :key="axis"><dt>{{ axis }}</dt><dd>{{ AXIS_LABEL[axis] }}</dd></div></dl>
          </section>
          <section class="impact panel" aria-labelledby="impact-heading">
            <div class="impact-title"><Icon name="cards" :size="21" /><div><h2 id="impact-heading">Squad impact</h2><p>{{ inDeck ? now.name + ' is in your squad' : 'This player is not in your squad' }}</p></div></div>
            <div class="power"><span>Squad Power</span><div class="power-values"><strong>{{ fmt(powerBefore) }}</strong><template v-if="inDeck && next"><span aria-hidden="true">→</span><strong class="gain-text">{{ fmt(powerAfter) }}</strong><span class="gain-pill">{{ powerGain >= 0 ? '+' : '' }}{{ powerGain }}</span></template></div></div>
            <p v-if="!inDeck" class="impact-note">Upgrading this player will not change your current Squad Power.</p>
          </section>
          <section v-if="next" class="cost panel" aria-labelledby="cost-heading">
            <div class="cost-head"><h2 id="cost-heading"><svg class="shard-icon" width="20" height="24" viewBox="0 0 24 28" aria-hidden="true"><path d="M8 2l9 2 4 9-8 13-9-4L2 12z" fill="#b7c3d2"/><path d="M8 2l2 10-6 10m6-10 11 1m-11-1 3 14" fill="none" stroke="#edf3fa" stroke-width="1.2"/></svg>Upgrade cost</h2><strong class="cost-number">{{ cost }} shard{{ cost === 1 ? '' : 's' }}</strong></div>
            <div class="cost-balance"><div><span>Available</span><strong>{{ entry(target).shards }}</strong></div><div><span>After upgrade</span><strong>{{ can ? entry(target).shards - cost : '—' }}</strong></div></div>
            <p class="cost-hint" :class="{ short: !can }">{{ can ? 'Uses this player’s shards.' : `${missing} more shard${missing === 1 ? '' : 's'} needed.` }}</p>
          </section>
          <section v-else class="max-panel panel"><h2>Max level reached</h2><p>Lv.10 is the highest level. No more shards are needed.</p></section>
        </div>
      </template>
    </div>
    <footer v-if="target" class="upgrade-actions">
      <button v-if="next" class="btn btn-cta upgrade-button" :disabled="!can" data-sfx="upgrade" @click="doUpgrade"><span v-if="can" class="upgrade-arrow" aria-hidden="true">↑</span>{{ can ? `Upgrade to Lv.${next.level} · ${cost} shard${cost === 1 ? '' : 's'}` : `Need ${missing} more shard${missing === 1 ? '' : 's'}` }}</button>
      <button class="btn back-collection" @click="go('cards')">Back to collection</button>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import Icon from '../components/Icon.vue'
import CardFace from '../components/CardFace.vue'
import RadarChart from '../components/RadarChart.vue'
import { store, go, cardOf, entry, canUpgrade, upgradeCost, upgradeCard, BY_ID, deckPower, deckPowerWith, powerScore } from '../game.js'
import { buildCard, AXIS_LABEL, ROLE_LABEL, RARITY } from '../engine/cards.js'

const radarRef = ref(null)
const initialTarget = store.upgradeTarget
const target = ref(BY_ID[initialTarget] && entry(initialTarget).level >= 1 ? initialTarget : null)
const receipt = ref(null)
const tick = ref(0)
const now = computed(() => { tick.value; return target.value ? cardOf(target.value) : null })
const cost = computed(() => { tick.value; return target.value ? upgradeCost(target.value) : null })
const can = computed(() => { tick.value; return !!target.value && canUpgrade(target.value) })
const next = computed(() => {
  tick.value
  if (!target.value) return null
  const lv = entry(target.value).level
  return lv < 10 ? buildCard(BY_ID[target.value], lv + 1) : null
})
const delta = computed(() => Object.fromEntries((now.value?.axisKeys || []).map(k => [k, next.value ? next.value.axes[k] - now.value.axes[k] : 0])))
const missing = computed(() => cost.value ? Math.max(0, cost.value - entry(target.value).shards) : 0)
const chartSummary = computed(() => now.value ? now.value.axisKeys.map(k => `${AXIS_LABEL[k]} ${now.value.axes[k]}${next.value ? ', gain ' + delta.value[k] : ''}`).join('; ') : '')
const inDeck = computed(() => !!target.value && Object.values(store.deck).includes(target.value))
const powerBefore = computed(() => { tick.value; return deckPower() })
const powerAfter = computed(() => {
  tick.value
  if (!inDeck.value || !next.value) return powerBefore.value
  return deckPowerWith({ [target.value]: entry(target.value).level + 1 })
})
const powerGain = computed(() => Number(powerScore(powerAfter.value)) - Number(powerScore(powerBefore.value)))
function fmt (q) { return powerScore(q) }
function doUpgrade () {
  if (!can.value || !next.value) return
  const before = { ...now.value.axes }
  const spent = cost.value
  const level = next.value.level
  if (!upgradeCard(target.value)) return
  receipt.value = { level, spent }
  tick.value++
  // Numbers settle immediately; the existing radar animation morphs only the shape.
  nextTick(() => { if (radarRef.value) radarRef.value.morph(before) })
}
</script>

<style scoped>
.up { display:flex; flex-direction:column; background:#191e25; min-height:0; }
.up-content { min-height:0; scrollbar-width:thin; scrollbar-color:#505966 transparent; }
.head { display:flex; align-items:center; gap:16px; padding:16px; background:linear-gradient(100deg,#141d28bb,#14202b99 70%,#191e25bb),url('../assets/rank-art/stadium.webp') center 55% / cover; }
.mini { width:92px; flex:0 0 92px; }
.hinfo { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
.upgrade-badges { display:flex; align-items:center; gap:7px; }
.rarity,.squad-badge { display:inline-flex; align-items:center; min-height:23px; padding:3px 8px; border:1px solid #8590a0; border-radius:5px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.02em; line-height:15px; background:#252f3bc9; color:#c6cfdd; }
.rarity { color:var(--rc); border-color:var(--rc); }
.squad-badge.selected { color:#80e7a3; border-color:#4f9c6d; background:#163327a6; }
.hn { font-size:23px; letter-spacing:-.025em; line-height:1.1; }
.role { font-size:12px; color:#c6cfdd; margin:0; }
.hl { display:flex; align-items:center; gap:9px; margin-top:3px; font-size:20px; font-weight:600; color:#bdc8d9; }
.hl strong { color:#72ed9b; }
.level-arrow { color:#9caabc; }
.max-tag { font-size:10px; text-transform:uppercase; border:1px solid #72b88b; padding:3px 6px; border-radius:5px; color:#8de8ab; }
.total { display:flex; align-items:center; flex-wrap:wrap; gap:5px; margin-top:3px; font-size:12px; }
.total > span:first-child { color:#bbc7d9; margin-right:1px; }
.gain-text { color:#78eca1; }
.gain-pill { display:inline-flex; align-items:center; justify-content:center; min-height:22px; padding:2px 6px; border:1px solid #499f6a; border-radius:6px; background:#173a2955; color:#80eaa5; font-size:11px; font-weight:700; line-height:16px; }
.total .gain-pill { min-height:20px; font-size:10px; padding:1px 5px; }
.upgrade-body { display:flex; flex-direction:column; gap:12px; padding:0 12px 12px; }
.panel { border:1px solid #414d5c; border-radius:10px; padding:12px; background:linear-gradient(125deg,#29313c,#202832); }
.panel h2 { font-size:12px; text-transform:uppercase; letter-spacing:.02em; color:#e0e7f1; }
.panel-head { width:100%; }
.panel-head p { color:#b7c3d5; font-size:11px; margin:3px 0 0; }
.radwrap { display:flex; flex-direction:column; align-items:center; }
.radwrap :deep(.radar) { max-width:100%; height:auto; margin:3px 0 2px; }
.radwrap :deep(.lbl) { font-size:9px; fill:#c1cddd; }
.radwrap :deep(.val) { font-size:11px; transform:translateY(5px); }
.radwrap :deep(.val .flat) { fill:#a1aec1; }
.legend { display:flex; gap:22px; color:#bbc7d8; font-size:10px; line-height:16px; }
.sw { display:inline-block; width:16px; height:0; border-top:2px solid var(--radar-c); margin-right:6px; vertical-align:middle; }
.sw.dash { border-top:2px dashed var(--cta); }
.axis-key { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); width:100%; gap:7px 8px; margin:9px 0 0; padding-top:9px; border-top:1px solid #414d5c; }
.axis-key > div { display:flex; align-items:baseline; gap:4px; min-width:0; }
.axis-key dt { font-size:9px; font-weight:700; color:#d7dfec; }
.axis-key dd { margin:0; font-size:9px; color:#b8c4d6; }
.impact-title { display:flex; gap:9px; align-items:center; color:#b4c1d6; }
.impact-title p { font-size:11px; color:#b7c3d5; margin:3px 0 0; }
.power { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:10px; padding:9px 10px; border-radius:7px; background:#333c48; }
.power > span { color:#c5cfde; font-size:12px; }
.power-values { display:flex; align-items:center; gap:7px; font-variant-numeric:tabular-nums; }
.power-values strong { font-size:17px; }
.power-values > span:not(.gain-pill) { color:#b9c5d6; }
.impact-note { color:#b6c3d7; font-size:10px; line-height:1.5; margin:8px 0 0; }
.cost-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.cost-head h2,.cost-number { display:flex; align-items:center; gap:7px; }
.cost-head .icon { color:#c8d1df; }
.cost-number { font-size:12px; white-space:nowrap; }
.cost-balance { display:grid; grid-template-columns:1fr 1fr; gap:12px; border-top:1px solid #4c5868; padding-top:10px; margin-top:10px; font-size:11px; }
.cost-balance > div { display:flex; justify-content:space-between; align-items:center; gap:6px; }
.cost-balance > div + div { padding-left:12px; border-left:1px solid #4c5868; }
.cost-balance span { color:#becadd; }
.cost-balance strong { font-variant-numeric:tabular-nums; }
.cost-hint { min-height:15px; line-height:15px; margin:7px 0 0; font-size:10px; color:#b4c2d7; }
.cost-hint.short { color:#d5c1a2; }
.upgrade-actions { flex:none; display:flex; flex-direction:column; gap:8px; padding:10px 12px 12px; border-top:1px solid #3d4856; background:#1c232c; }
.upgrade-button { min-height:46px; height:46px; gap:9px; font-size:16px; background:linear-gradient(110deg,#63ed92,#35d96d); color:#082b15; }
.upgrade-arrow { font-size:25px; line-height:1; font-weight:800; }
.upgrade-button:disabled { color:#c0ccdd; background:#29333f; box-shadow:inset 0 0 0 1px #5c6b7e; font-size:14px; }
.back-collection { font-size:13px; color:#d9e2f0; background:#303b49; box-shadow:inset 0 0 0 1px #536175; }
.upgrade-actions .btn:focus-visible,.add-squad:focus-visible { outline:2px solid var(--cta); outline-offset:2px; }
.done-banner { display:flex; align-items:center; gap:10px; padding:12px; border:1px solid #518b67; border-radius:9px; background:linear-gradient(110deg,#1f3c2d,#24322e); }
.done-check { color:#85e8a4; font-size:22px; }
.done-banner h2 { font-size:13px; color:#a0eeb9; }
.done-banner p { margin:3px 0 0; font-size:10px; color:#b8d8c5; }
.add-squad { margin-left:auto; min-height:44px; padding:0 7px; border:1px solid #6c967b; border-radius:6px; font-size:11px; font-weight:600; }
.max-panel h2 { color:#98e6b2; }
.max-panel p { font-size:11px; line-height:1.5; color:#bbc9dc; margin:7px 0 0; }
.no-card { display:flex; align-items:center; flex-direction:column; gap:14px; padding:60px 24px; text-align:center; color:#bbc8dc; }
.no-card h1 { font-size:20px; color:#e1e8f4; }
.no-card p { margin:0; font-size:13px; line-height:1.6; }
.no-card .btn { max-width:250px; font-size:14px; }
@media(max-width:370px) { .head { padding:12px; gap:12px; } .mini { width:78px; flex-basis:78px; } .hinfo { gap:4px; } .hn { font-size:20px; } .hl { font-size:18px; } .total { font-size:10px; gap:4px; } .rarity,.squad-badge { font-size:8px; padding:2px 6px; min-height:21px; } .upgrade-badges { gap:5px; } .upgrade-body { padding-left:10px; padding-right:10px; } .axis-key { grid-template-columns:repeat(2,minmax(0,1fr)); } .cost-head h2 { font-size:11px; } .cost-number { font-size:11px; } .power-values { gap:5px; } .power-values strong { font-size:15px; } .power-values .gain-pill { font-size:10px; } .upgrade-actions { padding-left:10px; padding-right:10px; } }
</style>
