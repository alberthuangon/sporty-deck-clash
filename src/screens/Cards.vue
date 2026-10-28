<template>
  <div ref="viewport" class="scroll pad cards-page">
    <div v-if="!detail" class="collection">
      <section class="collection-summary" aria-label="Collection progress">
        <p class="eyebrow">Your collection</p>
        <div class="collection-count"><strong>{{ ownedCount }} <span>/ {{ CATALOGUE.length }}</span></strong><span>players collected</span></div>
        <Icon name="cards" :size="64" :stroke="1" class="summary-stack" />
        <div class="collection-progress" role="progressbar" aria-label="Players collected" :aria-valuenow="ownedCount" :aria-valuemin="0" :aria-valuemax="CATALOGUE.length"><i :style="{ width: collectionPct + '%' }" /></div>
        <p class="collection-remaining">{{ ownedCount === CATALOGUE.length ? 'Collection complete. Every player discovered.' : `${CATALOGUE.length - ownedCount} players left to discover` }}</p>
      </section>
      <div class="collection-filters" role="group" aria-label="Filter collection">
        <button v-for="f in FILTERS" :key="f.id" :data-filter="f.id" :aria-pressed="ownership === f.id" :class="{ active: ownership === f.id }" @click="ownership = f.id"><span>{{ f.label }}</span><span class="filter-count">{{ filterCount(f.id) }}</span></button>
      </div>
      <div class="collection-tools">
        <div class="select-wrap"><select v-model="rarity" aria-label="Filter by rarity"><option value="all">All rarities</option><option v-for="(r, key) in RARITY" :key="key" :value="key">{{ r.label }}</option></select><span aria-hidden="true">⌄</span></div>
        <div class="select-wrap"><select v-model="sortBy" aria-label="Sort cards"><option value="owned">Owned first</option><option value="rarity">Rarity: high to low</option><option value="level">Level: high to low</option><option value="name">Name: A–Z</option></select><span aria-hidden="true">⌄</span></div>
      </div>
      <p class="result-count" role="status" aria-live="polite">{{ visibleCards.length }} {{ visibleCards.length === 1 ? 'player' : 'players' }} shown</p>
      <div v-if="visibleCards.length" class="grid">
        <div v-for="c in visibleCards" :key="c.id" class="slot">
          <button class="card-open" :aria-label="cardLabel(c)" @click="open(c.id)">
            <CardFace :card="cardOf(c.id)" size="sm" full :locked="!isOwned(c.id)" :sub="isOwned(c.id) ? '' : shardText(c)" :class="{ 'has-shards': !isOwned(c.id) && entry(c.id).shards > 0 }" />
          </button>
          <span class="card-status" :class="{ 'in-squad': inSquad(c.id), 'upgrade-ready': canUpgrade(c.id), uncollected: !isOwned(c.id) }"><span class="status-icon" aria-hidden="true">{{ canUpgrade(c.id) ? '↑' : inSquad(c.id) ? '✓' : isOwned(c.id) ? '•' : '' }}</span>{{ canUpgrade(c.id) ? 'Upgrade ready' : inSquad(c.id) ? 'In squad' : isOwned(c.id) ? 'Owned' : 'Not collected' }}</span>
        </div>
      </div>
      <section v-else class="collection-empty" aria-label="No matching cards"><Icon name="cards" :size="40" :stroke="1.3" /><h2>No matching players</h2><p>Try another rarity or collection filter.</p><button class="btn" @click="clearFilters">Show all players</button></section>
    </div>

    <div v-else class="detail">
      <HoloCard class="hero">
        <CardFace :card="cardOf(detail)" size="lg" :radar="false" full foil />
      </HoloCard>
      <div class="shards">
        <div class="srow">
          <span class="muted">Shards</span>
          <span>{{ entry(detail).shards }} / {{ cost }}</span>
        </div>
        <div class="bar"><i :style="{ width: barPct + '%' }"></i></div>
      </div>
      <button v-if="isOwned(detail) && cost" class="btn" :class="{ 'btn-cta': canUpgrade(detail) }"
              :disabled="!canUpgrade(detail)" @click="goUpgrade">
        {{ canUpgrade(detail) ? 'Upgrade to Lv.' + (entry(detail).level + 1) : 'Need more shards' }}
      </button>
      <div v-else-if="!isOwned(detail)" class="locked-note">
        <Icon name="lock" /> Not in your collection yet — pull it from a card pack.
      </div>
      <div v-else class="locked-note">Max level reached.</div>
      <!-- The radar and the table come AFTER the action, and the order is the
           whole fix. A 280x392 hero pushes 207px down the page; with the two
           read-only blocks still above it the Upgrade button lands 142.7px
           BELOW the fold, which no assertion here can catch — the gate asks
           whether a control got squashed, not whether anyone can see it.
           Moved, the same page costs the same 155px of scroll and the button
           sits 267.5px above the fold, because what went under it is the part
           you read rather than the part you press.
           Reordered in the MARKUP rather than with `order`, so the screen
           reader and the tab ring agree with the eye. -->
      <RadarChart :axis-keys="cardOf(detail).axisKeys" :values="cardOf(detail).axes"
                  :size="260" labels class="rad" :class="'r-' + BY_ID[detail].rarity" />
      <div class="meta">
        <div class="mrow"><span class="muted">Rarity</span><span>{{ RARITY[BY_ID[detail].rarity].label }}</span></div>
        <div class="mrow"><span class="muted">Level</span><span>{{ entry(detail).level || '—' }} / 10</span></div>
        <div class="mrow"><span class="muted">Total points</span><span>{{ cardOf(detail).total }}</span></div>
        <div class="mrow"><span class="muted">Single-axis cap</span><span>{{ cardOf(detail).cap }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import Icon from '../components/Icon.vue'
import CardFace from '../components/CardFace.vue'
import HoloCard from '../components/HoloCard.vue'
import RadarChart from '../components/RadarChart.vue'
import { store, go, CATALOGUE, BY_ID, cardOf, entry, owned as isOwned, canUpgrade, upgradeCost, RARITY } from '../game.js'
import { screenBack } from '../store.js'
import { SHARD_COST } from '../engine/economy.js'

const detail = ref(store.cardTarget || null)
const viewport = ref(null)
let gridScroll = 0
store.cardTarget = null
const ownedCount = computed(() => CATALOGUE.filter(c => isOwned(c.id)).length)
const FILTERS = [{ id: 'all', label: 'All' }, { id: 'owned', label: 'Owned' }, { id: 'uncollected', label: 'Uncollected' }]
const ownership = ref('all')
const rarity = ref('all')
const sortBy = ref('owned')
const rarityOrder = { C: 0, R: 1, E: 2, L: 3 }
const collectionPct = computed(() => CATALOGUE.length ? ownedCount.value / CATALOGUE.length * 100 : 0)
const visibleCards = computed(() => {
  const cards = CATALOGUE.filter(c =>
    (ownership.value === 'all' || (ownership.value === 'owned' ? isOwned(c.id) : !isOwned(c.id))) &&
    (rarity.value === 'all' || c.rarity === rarity.value))
  return cards.sort((a, b) => {
    if (sortBy.value === 'rarity') return rarityOrder[b.rarity] - rarityOrder[a.rarity]
    if (sortBy.value === 'level') return entry(b.id).level - entry(a.id).level
    if (sortBy.value === 'name') return a.name.localeCompare(b.name, 'en')
    return Number(isOwned(b.id)) - Number(isOwned(a.id))
  })
})
function filterCount (id) { return id === 'all' ? CATALOGUE.length : id === 'owned' ? ownedCount.value : CATALOGUE.length - ownedCount.value }
function inSquad (id) { return isOwned(id) && Object.values(store.deck).includes(id) }
function cardLabel (c) { return `${c.name}, ${RARITY[c.rarity].label}, ${isOwned(c.id) ? 'level ' + entry(c.id).level : 'not collected, ' + shardText(c)}${inSquad(c.id) ? ', in squad' : ''}${canUpgrade(c.id) ? ', upgrade ready' : ''}` }
function clearFilters () { ownership.value = 'all'; rarity.value = 'all' }

/* shards needed for the next step: the next level if owned, otherwise the
   Lv.1 -> Lv.2 cost, so an unowned card still shows meaningful progress */
const cost = computed(() => {
  if (!detail.value) return null
  return upgradeCost(detail.value) ?? SHARD_COST[BY_ID[detail.value].rarity][1]
})
const barPct = computed(() => {
  if (!detail.value || !cost.value) return 0
  return Math.min(100, (entry(detail.value).shards / cost.value) * 100)
})
/* what a card you do not own yet is worth chasing for */
function shardText (c) { const n = entry(c.id).shards; return `${n} shard${n === 1 ? '' : 's'}` }
function open (id) {
  gridScroll = viewport.value?.scrollTop || 0
  detail.value = id
  nextTick(() => { if (viewport.value) viewport.value.scrollTop = 0 })
}
function closeDetail () {
  detail.value = null
  nextTick(() => { if (viewport.value) viewport.value.scrollTop = gridScroll })
}

/* THE ONLY WAY OUT, now that the in-page "< All cards" button is gone. The
   two did exactly the same thing — this watch has always wired the top bar's
   arrow to `detail = null` — so the screen was offering one action twice.
   immediate: true is what makes the OTHER entrance work: arriving with
   store.cardTarget already set means `detail` is non-null before this watch
   would otherwise first fire, and without `immediate` that route would land
   on a detail page with no exit at all. Verified by state rather than by
   reading: the arrow is 44x44 and clicking it on a cardTarget arrival puts
   the grid back. */
watch(detail, v => { screenBack.value = v ? closeDetail : null }, { immediate: true })
onUnmounted(() => { screenBack.value = null })
function goUpgrade () { store.upgradeTarget = detail.value; go('upgrade') }
</script>

<style scoped>
.cards-page { background:#191e25; scrollbar-width:thin; scrollbar-color:#505966 transparent; }
.collection-summary { position:relative; isolation:isolate; overflow:hidden; padding:15px; border-radius:10px; border:1px solid #495362; background:linear-gradient(100deg,#171f2bee,#17202bd9),url('../assets/rank-art/stadium.webp') center 35% / cover; }
.eyebrow { margin:0 0 6px; color:#bdc6d4; font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
.collection-count { display:flex; flex-direction:column; gap:0; position:relative; z-index:1; }
.collection-count strong { font-size:32px; line-height:1.1; letter-spacing:-.04em; font-variant-numeric:tabular-nums; }
.collection-count strong span { color:#dce2ec; }
.collection-count > span { font-size:12px; color:#c3ccd9; margin-top:3px; }
.summary-stack { position:absolute; right:22px; top:24px; color:#9caec6; opacity:.52; transform:rotate(9deg); }
.collection-progress { height:7px; margin-top:13px; overflow:hidden; border-radius:10px; background:#384253; }
.collection-progress i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#32ce62,#61ee94); }
.collection-remaining { margin:7px 0 0; color:#b9c4d3; font-size:10px; }
.collection-filters { display:grid; grid-template-columns:.8fr .95fr 1.35fr; margin-top:12px; border:1px solid #46515f; border-radius:9px; background:linear-gradient(135deg,#2b323c,#232a33); overflow:hidden; }
.collection-filters button { position:relative; display:flex; align-items:center; justify-content:center; gap:5px; min-height:44px; font-size:12px; font-weight:600; color:#bfc8d6; }
.collection-filters button + button::before { content:''; position:absolute; left:0; top:11px; bottom:11px; width:1px; background:#46505e; }
.collection-filters button.active { color:#fff; }
.collection-filters button.active::after { content:''; position:absolute; bottom:0; left:9px; right:9px; height:3px; border-radius:3px; background:#53e988; }
.active .filter-count { color:#66ed98; }
.filter-count { font-variant-numeric:tabular-nums; }
.collection-tools { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:10px; }
.select-wrap { min-width:0; position:relative; }
.select-wrap select { width:100%; min-height:44px; padding:0 28px 0 12px; appearance:none; -webkit-appearance:none; color:#edf1f7; background:#252c35; border:1px solid #4d5868; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer; }
.select-wrap option { color:#edf1f7; background:#252c35; }
.select-wrap > span { position:absolute; right:12px; top:10px; color:#cbd3df; pointer-events:none; font-size:18px; line-height:18px; }
.collection-filters button:focus-visible,.card-open:focus-visible,.select-wrap select:focus-visible { outline:2px solid #5ce68c; outline-offset:-3px; border-radius:7px; }
.result-count { margin:9px 0 8px; color:#b1bdcd; font-size:10px; line-height:15px; }
.grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px 9px; }
.slot { position:relative; display:flex; flex-direction:column; min-width:0; gap:5px; }
.card-open { display:block; width:100%; text-align:left; border-radius:7px; }
.card-open > :deep(.cf) { width:100%; }
.slot :deep(.has-shards .cf-role) { color:var(--rc); font-weight:700; }
.slot :deep(.cf-role) { font-variant-numeric:tabular-nums; letter-spacing:.02em; }
.card-status { display:flex; align-items:center; justify-content:center; gap:3px; min-height:22px; line-height:20px; border:1px solid #586374; border-radius:20px; font-size:9px; font-weight:600; color:#c3cbd7; white-space:nowrap; }
.card-status.in-squad { border-color:#63c88a; color:#7feaa4; background:#16302455; }
.card-status.upgrade-ready { border-color:#63d693; color:#94f4b3; background:#1a3928; }
.card-status.uncollected { color:#aeb9c9; border-color:#505b6c; }
.status-icon { font-size:12px; font-weight:700; }
.collection-empty { display:flex; flex-direction:column; align-items:center; padding:40px 16px; color:#b9c4d3; text-align:center; gap:10px; }
.collection-empty h2 { font-size:17px; color:#eef2f8; }
.collection-empty p { margin:0 0 7px; font-size:12px; }
.collection-empty .btn { max-width:220px; font-size:13px; }
@media(max-width:370px) { .collection-summary { padding:12px; } .collection-filters button { font-size:10px; gap:4px; } .select-wrap select { font-size:10px; padding-left:9px; padding-right:23px; } .grid { gap:10px 7px; } .card-status { font-size:8px; gap:2px; } }
.detail { display: flex; flex-direction: column; align-items: center; gap: 12px; }
/* 280, the art brief's number, and the reorder above is what pays for it:
   the card grows 207px, the page ends up 155px longer than the screen, and
   the Upgrade button still sits 267.5px above the fold because what went
   under it is the radar and the stat table rather than the action. */
.hero { width: 280px; }
.hero :deep(.cf) { width: 100%; }
.rad { margin: 2px 0; }
.meta, .shards { width: 100%; background: var(--surface); border-radius: var(--r-md); padding: 10px 12px; }
.mrow, .srow { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
.bar { height: 6px; background: var(--surface-hi); border-radius: 999px; overflow: hidden; margin-top: 6px; }
.bar i { display: block; height: 100%; background: var(--cta); }
.detail > .btn { width: 100%; }
</style>
