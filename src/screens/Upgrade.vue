<template>
  <div class="scroll pad up">
    <template v-if="!target">
      <div class="locked-note">No card selected.</div>
      <button class="btn" @click="go('cards')">Open collection</button>
    </template>

    <template v-else>
      <div class="head">
        <CardFace :card="now" size="md" :radar="false" class="mini" />
        <div class="hinfo">
          <div class="hn">{{ now.name }}</div>
          <div class="hl muted">Lv.{{ now.level }} → <b class="green">Lv.{{ now.level + 1 }}</b></div>
          <div class="hc muted">Cost: {{ cost }} shard{{ cost > 1 ? 's' : '' }} · you have {{ entry(target).shards }}</div>
        </div>
      </div>

      <div class="radwrap">
        <RadarChart :axis-keys="now.axisKeys" :values="now.axes" :ghost="next ? next.axes : null"
                    :size="280" labels />
        <div class="legend">
          <span><i class="sw solid"></i>Now</span>
          <span><i class="sw dash"></i>Next level</span>
        </div>
      </div>

      <div class="deltas">
        <div v-for="k in now.axisKeys" :key="k" class="drow" :class="{ zero: !delta[k] }">
          <span>{{ AXIS_LABEL[k] }}</span>
          <span class="dv">
            {{ now.axes[k] }}
            <template v-if="delta[k]"> → {{ next.axes[k] }} <b class="green">+{{ delta[k] }}</b></template>
            <template v-else><span class="muted"> · unchanged</span></template>
          </span>
        </div>
      </div>

      <div class="power card">
        <span class="muted">Squad Power</span>
        <span>{{ fmt(powerBefore) }} <template v-if="inDeck">→ <b class="green">{{ fmt(powerAfter) }}</b></template>
          <span v-else class="muted">(not in squad)</span></span>
      </div>

      <div v-if="done" class="done-banner">
        <div class="db-t">Upgraded to Lv.{{ now.level }}</div>
        <div v-if="inDeck" class="db-s">Squad Power is now {{ fmt(powerBefore) }}</div>
        <button v-else class="btn btn-cta db-b" @click="go('deckedit')">
          Put {{ now.name }} in your squad
        </button>
      </div>

      <button v-if="!done || can" class="btn btn-cta" :disabled="!can" data-sfx="upgrade" @click="doUpgrade">
        {{ can ? 'Upgrade' : 'Not enough shards' }}
      </button>
      <button class="btn" @click="go('cards')">Back to collection</button>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import CardFace from '../components/CardFace.vue'
import RadarChart from '../components/RadarChart.vue'
import { store, go, cardOf, entry, canUpgrade, upgradeCost, upgradeCard, BY_ID, deckPower, powerScore } from '../game.js'
import { buildCard, AXIS_LABEL } from '../engine/cards.js'

const target = ref(store.upgradeTarget || null)
const done = ref(false)
const tick = ref(0)

const now = computed(() => { tick.value; return cardOf(target.value) })
const cost = computed(() => { tick.value; return upgradeCost(target.value) })
const can = computed(() => { tick.value; return canUpgrade(target.value) })
const next = computed(() => {
  tick.value
  const lv = entry(target.value).level
  return lv < 10 ? buildCard(BY_ID[target.value], lv + 1) : null
})
const delta = computed(() => {
  const out = {}
  now.value.axisKeys.forEach(k => { out[k] = next.value ? next.value.axes[k] - now.value.axes[k] : 0 })
  return out
})
const inDeck = computed(() => Object.values(store.deck).includes(target.value))
const powerBefore = computed(() => { tick.value; return deckPower() })
const powerAfter = computed(() => {
  tick.value
  if (!inDeck.value || !next.value) return powerBefore.value
  const saved = entry(target.value).level
  store.ownedCards[target.value].level = saved + 1
  const p = deckPower()
  store.ownedCards[target.value].level = saved
  return p
})
function fmt (q) { return powerScore(q) }
function doUpgrade () {
  if (upgradeCard(target.value)) { done.value = true; tick.value++ }
}
</script>

<style scoped>
.up { gap: 12px; display: flex; flex-direction: column; }
.head { display: flex; gap: 12px; align-items: center; }
.mini { width: 92px; flex: 0 0 92px; }
.hn { font-size: 17px; font-weight: 700; }
.hl { font-size: 13px; margin: 2px 0; }
.hc { font-size: 11px; }
.radwrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.legend { display: flex; gap: 14px; font-size: 11px; color: var(--text-2); }
.sw { display: inline-block; width: 14px; height: 0; border-top: 2px solid var(--green); margin-right: 5px; vertical-align: middle; }
.sw.dash { border-top: 2px dashed var(--cta); }
.deltas { background: var(--surface); border-radius: var(--r-md); padding: 4px 12px; }
.drow { display: flex; justify-content: space-between; font-size: 13px; padding: 7px 0; border-bottom: 1px solid var(--divider); }
.drow:last-child { border-bottom: 0; }
.drow.zero { opacity: .5; }
.dv { font-variant-numeric: tabular-nums; }
.power { display: flex; justify-content: space-between; padding: 12px; font-size: 13px; }
.done-banner { background: var(--cta-deep); color: #fff; text-align: center; padding: 12px; border-radius: var(--r-md); }
.db-t { font-size: 14px; font-weight: 800; }
.db-s { font-size: 12px; margin-top: 2px; }
.db-b { margin-top: 10px; }
</style>
