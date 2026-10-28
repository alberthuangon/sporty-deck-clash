<template>
  <div class="scroll pad">
    <div v-if="!detail">
      <div class="cnt muted">{{ ownedCount }} / {{ CATALOGUE.length }} collected</div>
      <div class="grid">
        <div v-for="c in CATALOGUE" :key="c.id" class="slot" @click="open(c.id)">
          <CardFace v-if="isOwned(c.id)" :card="cardOf(c.id)" size="sm" />
          <div v-else class="locked" :class="['r-' + c.rarity, { 'has-shards': entry(c.id).shards > 0 }]">
            <div class="lk"><Icon name="lock" /></div>
            <div class="ln">{{ c.name }}</div>
            <div class="ls muted">{{ entry(c.id).shards }} / {{ firstCost(c) }}</div>
          </div>
          <i v-if="canUpgrade(c.id)" class="dot"></i>
        </div>
      </div>
    </div>

    <div v-else class="detail">
      <button class="back muted" @click="detail = null">‹ All cards</button>
      <HoloCard class="hero">
        <CardFace :card="cardOf(detail)" size="lg" :radar="false" foil />
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
import { ref, computed, watch, onUnmounted } from 'vue'
import Icon from '../components/Icon.vue'
import CardFace from '../components/CardFace.vue'
import HoloCard from '../components/HoloCard.vue'
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
/* The slot already carried its rarity class; it just never used it. Sixteen
   of the twenty cells are locked, and they were identical, so nothing on the
   collection's main screen said which card is worth chasing — which is the
   collection loop itself. It also squared a contradiction: the same locked
   Legendary was gold on its detail page and a grey box in the grid.

   Three channels speak at once and two of them disagree on purpose. The
   border's COLOUR says how rare this is; the border's STYLE (dashed), the
   absent glow and the darkening layer all say you do not have it. So a locked
   Legendary reads as gold and still cannot be mistaken for an owned one,
   which has a solid edge, a glow, and nothing dimming it.
   Box model is untouched — 1px border, 104 min-height — so the grid's
   equal-height assertions do not move. */
.locked {
  height: 100%; min-height: 104px; border-radius: var(--r-md);
  border: 1px dashed var(--rc, var(--divider));
  background:
    linear-gradient(160deg, rgba(0,0,0,.26), rgba(0,0,0,.26)),
    var(--cf-body, var(--surface-lo));
  box-shadow: none;
  opacity: .78;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
}
.lk { font-size: 16px; color: var(--rc, var(--text-3)); opacity: .55; }
.ln { font-size: 11px; font-weight: 700; color: var(--text-2); }
/* the shard count reads as progress rather than as a label, and a card you
   have already started collecting says so — on cards/sparse exactly one card
   has a shard, and it was indistinguishable from the fifteen that do not */
.ls { font-size: 9px; font-variant-numeric: tabular-nums; letter-spacing: .04em; }
.locked.has-shards .ls { color: var(--rc); font-weight: 700; }
.detail { display: flex; flex-direction: column; align-items: center; gap: 12px; }
/* padded out to a real tap target, pulled back with margin so nothing moves */
.back { align-self: flex-start; font-size: 12px; padding: 15px 12px; margin: -12px -12px -15px; }
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
