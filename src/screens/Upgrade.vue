<template>
  <div class="scroll pad up">
    <template v-if="!target">
      <div class="empty"><div class="empty-t">No card selected.</div></div>
      <button class="btn" @click="go('cards')">Open collection</button>
    </template>

    <template v-else>
      <div class="head">
        <CardFace :card="now" size="md" :radar="false" full class="mini" />
        <div class="hinfo">
          <div class="hn">{{ now.name }}</div>
          <div class="hl muted">Lv.{{ now.level }} → <b class="green">Lv.{{ now.level + 1 }}</b></div>
          <div class="hc muted">Cost: {{ cost }} shard{{ cost > 1 ? 's' : '' }} · you have {{ entry(target).shards }}</div>
        </div>
      </div>

      <!-- THE TABLE IS THE CHART NOW. Six axis figures were on screen twice,
           both copies inside one scroll, which is what Albert called out. The
           gains move onto the chart beside the numbers they change.
           Three things only the table was saying had to go somewhere rather
           than quietly disappear: the gain on an axis that gains nothing (a
           muted +0 on every axis, in RadarChart), the two invented axis names
           (the line under the legend), and the key to the dashed polygon,
           which the table used to make unnecessary and now does not.
           A card at Lv.10 passes no deltas at all rather than six +0s: there
           is no next level to gain nothing from, and "+0" there would be
           describing an upgrade that does not exist. -->
      <div class="radwrap" :class="'r-' + BY_ID[target].rarity">
        <RadarChart ref="radarRef" :axis-keys="now.axisKeys" :values="now.axes"
                    :ghost="next ? next.axes : null" :deltas="next ? delta : null" :size="280" labels />
        <div class="legend">
          <span><i class="sw solid"></i>Now</span>
          <span><i class="sw dash"></i>Next level</span>
        </div>
        <!-- SHO / DRI / PAS / DEF are football; a player who has never seen
             this game still reads them. HOM and AWY are this product's own
             invention — Home Spirit and Away Form, meaning he plays better at
             home or away rather than anything about which team he is on — and
             three letters cannot carry that. The table spelled them out in
             full and was the only thing that did. -->
        <div v-if="hasVenueAxes" class="axnote muted">
          HOM · AWY — how well he plays at home and away
        </div>
      </div>

      <div class="power card">
        <span class="muted">Squad Power</span>
        <span>{{ fmt(powerBefore) }} <template v-if="inDeck">→ <b class="green">{{ fmt(powerAfter) }}</b></template>
          <span v-else class="muted">(not in squad)</span></span>
      </div>

      <div v-if="done" class="done-banner banner-win">
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
import { ref, computed, nextTick } from 'vue'
import CardFace from '../components/CardFace.vue'
import RadarChart from '../components/RadarChart.vue'
import { store, go, cardOf, entry, canUpgrade, upgradeCost, upgradeCard, BY_ID, deckPower, deckPowerWith, powerScore } from '../game.js'
import { buildCard } from '../engine/cards.js'

const radarRef = ref(null)
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
const hasVenueAxes = computed(() => now.value.axisKeys.some(k => k === 'HOM' || k === 'AWY'))
const inDeck = computed(() => Object.values(store.deck).includes(target.value))
const powerBefore = computed(() => { tick.value; return deckPower() })
const powerAfter = computed(() => {
  tick.value
  if (!inDeck.value || !next.value) return powerBefore.value
  return deckPowerWith({ [target.value]: entry(target.value).level + 1 })
})
function fmt (q) { return powerScore(q) }
function doUpgrade () {
  /* snapshot BEFORE the upgrade: afterwards `now` is the new card and the old
     shape is gone. Every number on this screen — the delta rows, the squad
     power, the radar's own axis labels — updates in the same tick. Only the
     polygon takes the scenic route (§2.1). */
  const before = { ...now.value.axes }
  if (!upgradeCard(target.value)) return
  done.value = true
  tick.value++
  nextTick(() => { if (radarRef.value) radarRef.value.morph(before) })
}
</script>

<style scoped>
.up { gap: 12px; display: flex; flex-direction: column; }
.head { display: flex; gap: 12px; align-items: center; }
/* 74, down from 92, because the card went from a stacked box to a 5:7 one
   and 92 would have made it 128.8 tall. Measured: that is 37.1px of growth on
   a column whose fullest state (upgrade/done, with the "Upgraded to Lv.N"
   banner) had 27px of room, and the overflow landed on the one child flex
   was allowed to squash — `Back to collection` went to 21.5px and failed the
   44px tap target. 74 costs 11.9 and leaves 17.6.

   The first measurement said this page had 87.6px free and would fit. It was
   taken on upgrade/ready-in-squad, which has no banner: one state per screen
   is not a measurement of the screen. */
.mini { width: 74px; flex: 0 0 74px; }
.hn { font-size: 17px; font-weight: 700; }
.hl { font-size: 13px; margin: 2px 0; }
.hc { font-size: 11px; }
.radwrap { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.legend { display: flex; gap: 14px; font-size: 11px; color: var(--text-2); }
/* The swatch has to come from the same source as the line it describes, so
   the rarity class sits on .radwrap rather than on the chart — the chart reads
   an inherited variable either way, and this way the legend inherits it too.
   Without that the key would be a different colour from its own chart. */
.sw { display: inline-block; width: 14px; height: 0; border-top: 2px solid var(--radar-c, var(--green)); margin-right: 5px; vertical-align: middle; }
.sw.dash { border-top: 2px dashed var(--cta); }
.axnote { font-size: 10px; letter-spacing: .01em; text-align: center; margin-top: 2px; }
.power { display: flex; justify-content: space-between; padding: 12px; font-size: 13px; }
/* .banner-win carries the colour now (base.css): a state, not an action.
   It used to be a deep-green slab with a mint button sitting inside it, two
   greens touching where one is a thing that happened and the other a thing
   to do. */
.done-banner { text-align: center; padding: 12px; }
.db-t { font-size: 14px; font-weight: 800; }
.db-s { font-size: 12px; margin-top: 2px; }
.db-b { margin-top: 10px; }
</style>
