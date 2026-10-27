<template>
  <div class="scroll pad">
    <div v-if="!detail">
      <div class="cnt muted">{{ ownedCount }} / {{ CATALOGUE.length }} collected</div>
      <div class="grid">
        <div v-for="c in CATALOGUE" :key="c.id" class="slot" @click="open(c.id)">
          <CardFace v-if="isOwned(c.id)" :card="cardOf(c.id)" size="sm" />
          <div v-else class="locked" :class="'r-'+c.rarity">
            <div class="lk">🔒</div>
            <div class="ln">{{ c.name }}</div>
            <div class="ls muted">{{ entry(c.id).shards }} / {{ firstCost(c) }}</div>
          </div>
          <i v-if="canUpgrade(c.id)" class="dot"></i>
        </div>
      </div>
    </div>

    <div v-else class="detail">
      <button class="back muted" @click="detail = null">‹ All cards</button>
      <CardFace :card="cardOf(detail)" size="lg" class="hero" :radar="false" />
      <RadarChart :axis-keys="cardOf(detail).axisKeys" :values="cardOf(detail).axes"
                  :size="260" labels class="rad" :class="'r-' + BY_ID[detail].rarity" />
      <div class="meta">
        <div class="mrow"><span class="muted">Rarity</span><span>{{ RARITY[BY_ID[detail].rarity].label }}</span></div>
        <div class="mrow"><span class="muted">Level</span><span>{{ entry(detail).level || '—' }} / 10</span></div>
        <div class="mrow"><span class="muted">Total points</span><span>{{ cardOf(detail).total }}</span></div>
        <div class="mrow"><span class="muted">Single-axis cap</span><span>{{ cardOf(detail).cap }}</span></div>
      </div>
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
        🔒 Not in your collection yet — pull it from a card pack.
      </div>
      <div v-else class="locked-note">Max level reached.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import CardFace from '../components/CardFace.vue'
import RadarChart from '../components/RadarChart.vue'
import { store, go, CATALOGUE, BY_ID, cardOf, entry, owned as isOwned, canUpgrade, upgradeCost, RARITY } from '../game.js'
import { screenBack } from '../store.js'
import { SHARD_COST } from '../engine/economy.js'

const detail = ref(store.cardTarget || null)
store.cardTarget = null
const ownedCount = computed(() => CATALOGUE.filter(c => isOwned(c.id)).length)
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
function firstCost (c) { return SHARD_COST[c.rarity][1] }
function open (id) { detail.value = id }

/* the top bar's back arrow leaves the detail view before it leaves the tab */
watch(detail, v => { screenBack.value = v ? () => { detail.value = null } : null }, { immediate: true })
onUnmounted(() => { screenBack.value = null })
function goUpgrade () { store.upgradeTarget = detail.value; go('upgrade') }
</script>

<style scoped>
.cnt { font-size: 12px; margin-bottom: 10px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
/* the cell stretches to the tallest card in its row; without this the card
   inside does not, and owned cards render 14px shorter than locked ones */
.slot { position: relative; cursor: pointer; display: flex; }
.slot > * { flex: 1; min-width: 0; }
.locked {
  height: 100%; min-height: 104px; border-radius: var(--r-md);
  border: 1px dashed var(--divider); background: var(--surface-lo);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
}
.lk { font-size: 16px; opacity: .5; }
.ln { font-size: 11px; font-weight: 700; color: var(--text-2); }
.ls { font-size: 9px; }
.detail { display: flex; flex-direction: column; align-items: center; gap: 12px; }
/* padded out to a real tap target, pulled back with margin so nothing moves */
.back { align-self: flex-start; font-size: 12px; padding: 15px 12px; margin: -12px -12px -15px; }
.hero { width: 150px; }
.rad { margin: 2px 0; }
.meta, .shards { width: 100%; background: var(--surface); border-radius: var(--r-md); padding: 10px 12px; }
.mrow, .srow { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
.bar { height: 6px; background: var(--surface-hi); border-radius: 999px; overflow: hidden; margin-top: 6px; }
.bar i { display: block; height: 100%; background: var(--cta); }
.detail > .btn { width: 100%; }
</style>
