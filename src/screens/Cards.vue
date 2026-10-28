<template>
  <div class="scroll pad">
    <div v-if="!detail">
      <div class="cnt muted">{{ ownedCount }} / {{ CATALOGUE.length }} collected</div>
      <div class="grid">
        <!-- ONE COMPONENT FOR BOTH, and that is the change rather than a
             tidy-up. The locked cell used to be a bespoke div whose height
             set the row, and the owned CardFace had to be built to match it;
             turning one full-bleed without the other would have left every
             row ragged. They are the same card now, and the only difference
             is what a card you do not own is allowed to say: a shard count
             where the role goes, under a lock and a dark layer. -->
        <div v-for="c in CATALOGUE" :key="c.id" class="slot" @click="open(c.id)">
          <CardFace
            :card="cardOf(c.id)" size="sm" full
            :locked="!isOwned(c.id)"
            :sub="isOwned(c.id) ? '' : shardText(c)"
            :class="{ 'has-shards': !isOwned(c.id) && entry(c.id).shards > 0 }"
          />
          <i v-if="canUpgrade(c.id)" class="dot"></i>
        </div>
      </div>
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
/* what a card you do not own yet is worth chasing for */
function shardText (c) { return `${entry(c.id).shards} / ${firstCost(c)}` }
function open (id) { detail.value = id }

/* THE ONLY WAY OUT, now that the in-page "< All cards" button is gone. The
   two did exactly the same thing — this watch has always wired the top bar's
   arrow to `detail = null` — so the screen was offering one action twice.
   immediate: true is what makes the OTHER entrance work: arriving with
   store.cardTarget already set means `detail` is non-null before this watch
   would otherwise first fire, and without `immediate` that route would land
   on a detail page with no exit at all. Verified by state rather than by
   reading: the arrow is 44x44 and clicking it on a cardTarget arrival puts
   the grid back. */
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
/* The grid cell is a CARD now, not a box with a label in it, so the rarity
   ladder it used to draw by hand (dashed edge, no glow, dark layer) moved
   into CardFace where owned and locked can be guaranteed the same shape.
   What stays here is the one thing that is about the COLLECTION rather than
   about the card: a card you have already started collecting says so. On
   cards/sparse exactly one card has a shard, and it was indistinguishable
   from the fifteen that do not. */
.slot :deep(.has-shards .cf-role) { color: var(--rc); font-weight: 700; }
.slot :deep(.cf-role) { font-variant-numeric: tabular-nums; letter-spacing: .02em; }
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
