<template>
  <div ref="viewport" class="scroll pad cards-page" :class="{ 'detail-mode': detail }">
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
      <section class="detail-stage" aria-label="Player card">
        <div class="detail-badges">
          <span class="rarity-badge" :class="'r-' + BY_ID[detail].rarity">{{ RARITY[BY_ID[detail].rarity].label }}</span>
          <span class="ownership-badge" :class="{ 'is-squad': inSquad(detail) }"><span aria-hidden="true">{{ inSquad(detail) ? '✓' : !isOwned(detail) ? '◇' : '•' }}</span>{{ inSquad(detail) ? 'In squad' : isOwned(detail) ? 'Owned' : 'Not collected' }}</span>
        </div>
        <HoloCard class="hero">
          <CardFace :card="detailCard" size="lg" :radar="false" :locked="!isOwned(detail)" full foil />
        </HoloCard>
      </section>
      <div class="detail-body">
        <section class="detail-meta" aria-label="Card information">
          <div><span>Level</span><strong>{{ isOwned(detail) ? entry(detail).level : '—' }} <small>/ 10</small></strong></div>
          <div><span>Total points</span><strong>{{ detailCard.total }}</strong></div>
          <div><span>Per-axis cap</span><strong>{{ detailCard.cap }}</strong></div>
        </section>

        <section v-if="isOwned(detail) && cost" class="upgrade-panel" aria-labelledby="upgrade-heading">
          <div class="detail-panel-head"><h2 id="upgrade-heading">Next upgrade</h2><span class="next-level">Lv.{{ entry(detail).level + 1 }}</span></div>
          <div class="shard-row"><span>Shards</span><strong>{{ entry(detail).shards }} / {{ cost }}</strong></div>
          <div class="shard-track" role="progressbar" aria-label="Shards for next upgrade" :aria-valuenow="Math.min(entry(detail).shards, cost)" :aria-valuemin="0" :aria-valuemax="cost"><i :style="{ width: barPct + '%' }" /></div>
          <p class="shard-hint" :class="{ ready: canUpgrade(detail) }">{{ canUpgrade(detail) ? 'Ready to take this player to the next level.' : `${remainingShards} more shard${remainingShards === 1 ? '' : 's'} needed` }}</p>
          <button class="btn detail-upgrade" :class="{ 'btn-cta': canUpgrade(detail) }" :disabled="!canUpgrade(detail)" @click="goUpgrade">{{ canUpgrade(detail) ? 'Upgrade to Lv.' + (entry(detail).level + 1) : `Need ${remainingShards} more shard${remainingShards === 1 ? '' : 's'}` }}</button>
          <button v-if="!canUpgrade(detail)" class="detail-shop" @click="go('shop')">Find card packs in Shop <span aria-hidden="true">›</span></button>
        </section>
        <section v-else-if="!isOwned(detail)" class="upgrade-panel unowned-panel" aria-labelledby="unowned-heading">
          <div class="detail-panel-head"><h2 id="unowned-heading"><Icon name="lock" :size="15" /> Not collected</h2></div>
          <p>Find this player in a card pack to add them to your collection.</p>
          <p v-if="entry(detail).shards" class="saved-shards">{{ shardText(BY_ID[detail]) }} saved. Shards upgrade players you already own.</p>
          <button class="btn btn-cta detail-upgrade" @click="go('shop')">Find card packs in Shop <span aria-hidden="true">›</span></button>
        </section>
        <section v-else class="upgrade-panel max-level-panel" aria-labelledby="max-heading">
          <div class="detail-panel-head"><h2 id="max-heading">Max level reached</h2><span class="complete-badge">Lv.10</span></div>
          <p>This player has reached the highest level.</p>
        </section>

        <section class="attributes-panel" :class="'r-' + BY_ID[detail].rarity" aria-labelledby="attributes-heading">
          <div class="detail-panel-head"><h2 id="attributes-heading">Player attributes</h2><span class="attribute-info" aria-hidden="true">ⓘ</span></div>
          <p v-if="!isOwned(detail)" class="attribute-preview">Lv.1 preview · Collect this player to use them.</p>
          <RadarChart :axis-keys="detailCard.axisKeys" :values="detailCard.axes" :size="244" labels class="rad" role="img" :aria-label="attributeSummary" />
          <dl class="axis-key"><div v-for="axis in detailCard.axisKeys" :key="axis"><dt>{{ axis }}</dt><dd>{{ AXIS_LABEL[axis] }}</dd></div></dl>
        </section>
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
import { AXIS_LABEL } from '../engine/cards.js'

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

const detailCard = computed(() => detail.value ? cardOf(detail.value) : null)
// Only owned, non-max cards have an upgrade cost. Uncollected shards never unlock a player.
const cost = computed(() => detail.value && isOwned(detail.value) ? upgradeCost(detail.value) : null)
const remainingShards = computed(() => cost.value ? Math.max(0, cost.value - entry(detail.value).shards) : 0)
const attributeSummary = computed(() => detailCard.value ? detailCard.value.axisKeys.map(k => `${AXIS_LABEL[k]} ${detailCard.value.axes[k]}`).join(', ') : '')
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

.cards-page.detail-mode { padding:0; }
.detail { display:flex; flex-direction:column; min-height:100%; }
.detail-stage { display:flex; flex-direction:column; align-items:center; gap:12px; padding:16px 12px 16px; background:linear-gradient(180deg,#14202d66,#191e2533 65%,#191e25),url('../assets/rank-art/stadium.webp') center / cover; }
.detail-badges { display:flex; justify-content:center; align-items:center; gap:8px; min-height:25px; }
.rarity-badge,.ownership-badge { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:25px; padding:4px 12px; border:1px solid #7d899b; border-radius:6px; font-size:10px; font-weight:700; line-height:15px; text-transform:uppercase; letter-spacing:.035em; }
.rarity-badge { color:var(--rc); background:#202832d9; border-color:var(--rc); }
.ownership-badge { color:#c7d0dd; border-radius:20px; background:#19232dcc; }
.ownership-badge.is-squad { color:#83eaa5; border-color:#6cd393; background:#163024aa; }
.hero { width:224px; max-width:calc(100% - 38px); }
.hero :deep(.cf) { width:100%; }
.detail-body { display:flex; flex-direction:column; gap:12px; padding:0 12px 18px; }
.detail-meta { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); padding:13px 5px; border:1px solid #424d5a; border-radius:9px; background:linear-gradient(125deg,#29313b,#222a33); }
.detail-meta > div { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; }
.detail-meta > div + div { border-left:1px solid #586170; }
.detail-meta > div > span { text-transform:uppercase; letter-spacing:.035em; font-size:9px; font-weight:600; color:#bfc8d6; }
.detail-meta strong { font-size:20px; font-variant-numeric:tabular-nums; line-height:1.15; }
.detail-meta small { font-size:15px; font-weight:600; }
.upgrade-panel,.attributes-panel { padding:12px; border:1px solid #414b59; border-radius:10px; background:linear-gradient(125deg,#28303a,#202831); }
.detail-panel-head { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:20px; }
.detail-panel-head h2 { display:flex; align-items:center; gap:6px; font-size:12px; color:#d6deea; text-transform:uppercase; letter-spacing:.02em; }
.next-level { font-size:14px; font-weight:700; }
.shard-row { display:flex; justify-content:space-between; margin-top:11px; padding-top:10px; border-top:1px solid #4c5663; font-size:12px; color:#c2cbd7; }
.shard-row strong { color:#f0f4fa; font-variant-numeric:tabular-nums; }
.shard-track { height:7px; overflow:hidden; border:1px solid #5e6979; border-radius:20px; background:#202731; margin-top:8px; }
.shard-track i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#32ce62,#68ef9a); }
.shard-hint { color:#b5c0d0; font-size:10px; line-height:15px; margin:7px 0 10px; }
.shard-hint.ready { color:#91e8af; }
.detail-upgrade { min-height:44px; font-size:14px; gap:8px; }
.detail-upgrade:disabled { color:#c2cbd8; background:#2b333e; box-shadow:inset 0 0 0 1px #667181; }
.detail-shop { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; min-height:44px; margin-bottom:-4px; margin-top:3px; font-size:11px; color:#c7d1df; }
.detail-shop > span { font-size:20px; }
.detail-shop:focus-visible,.detail-upgrade:focus-visible { outline:2px solid var(--cta); outline-offset:2px; border-radius:5px; }
.unowned-panel p,.max-level-panel p { color:#c2ccda; font-size:12px; line-height:1.6; margin:10px 0; }
.unowned-panel .saved-shards { color:#afbccf; font-size:11px; }
.unowned-panel .detail-upgrade { margin-top:12px; }
.max-level-panel p { margin-bottom:0; }
.complete-badge { color:#8ae7a8; font-size:12px; font-weight:700; padding:3px 7px; border:1px solid #629d77; border-radius:5px; }
.attributes-panel { display:flex; flex-direction:column; align-items:center; }
.attributes-panel .detail-panel-head { align-self:stretch; }
.attribute-info { font-size:18px; color:#b9c5d6; }
.rad { margin:10px 0 7px; max-width:100%; height:auto; }
.rad :deep(.lbl) { font-size:9px; fill:#c3cddb; }
.rad :deep(.val) { font-size:11px; transform:translateY(5px); }
.axis-key { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); width:100%; gap:7px 10px; margin:0; padding-top:11px; border-top:1px solid #414c5a; }
.axis-key > div { display:flex; align-items:baseline; gap:5px; min-width:0; }
.axis-key dt { font-size:10px; font-weight:700; color:#d9e0eb; }
.axis-key dd { margin:0; font-size:10px; color:#b7c3d5; }
.attribute-preview { font-size:10px; color:#b7c3d5; margin:9px 0 0; }
@media(max-width:370px) { .detail-stage { padding-top:12px; } .hero { width:206px; } .detail-meta > div > span { font-size:8px; } .detail-meta strong { font-size:18px; } .detail-body { padding-left:10px; padding-right:10px; } .axis-key { column-gap:6px; } .axis-key dd,.axis-key dt { font-size:9px; } }
</style>
