<template>
  <div class="scroll pad de">
    <div class="power card">
      <div>
        <div class="muted" style="font-size:11px">Squad Power</div>
        <PowerStars :q="power" />
      </div>
      <div class="lean">
        <div class="muted" style="font-size:11px">Venue lean</div>
        <div class="lean-bar"><i :style="leanStyle"></i></div>
        <div class="lean-lbl muted">{{ leanLabel }}</div>
      </div>
    </div>

    <div class="slots">
      <div v-for="s in SLOTS" :key="s.key" class="slot" :class="{ active: picking === s.key }"
           @click="picking = picking === s.key ? null : s.key">
        <div class="slot-lbl">{{ s.label }}</div>
        <CardFace :card="cardOf(draft[s.key])" size="sm" :radar="false" />
      </div>
    </div>

    <div v-if="picking" class="picker">
      <div class="sec-title">Choose {{ SLOTS.find(s => s.key === picking).label }}</div>
      <div class="pick-grid">
        <CardFace v-for="id in options" :key="id" :card="cardOf(id)" size="sm" :radar="false"
                  :selected="draft[picking] === id" :dim="usedElsewhere(id)"
                  @click="choose(id)" />
      </div>
      <div v-if="!options.length" class="locked-note">No other cards for this slot yet.</div>
    </div>

    <button class="btn" @click="autoPlace">Auto-place for max Power</button>
    <div class="btn-row">
      <button class="btn" @click="go('home')">Cancel</button>
      <button class="btn btn-cta" @click="save">Save squad</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import CardFace from '../components/CardFace.vue'
import PowerStars from '../components/PowerStars.vue'
import { store, go, cardOf, ownedIds, BY_ID, deckPower, venueLean, bestPlacement } from '../game.js'

const SLOTS = [
  { key: 'gk', label: 'Goalkeeper' },
  { key: 'df', label: 'Defender' },
  { key: 'mf', label: 'Midfielder' },
  { key: 'fw', label: 'Forward' }
]
const draft = ref({ ...store.deck })
const picking = ref(null)

const power = computed(() => deckPower(draft.value))
const lean = computed(() => venueLean(draft.value))
const leanStyle = computed(() => ({ left: `${50 + lean.value * 900}%` }))
const leanLabel = computed(() => {
  const v = lean.value * 100
  if (v > 0.4) return 'Home specialist'
  if (v < -0.4) return 'Away specialist'
  return 'Balanced'
})

const options = computed(() => {
  if (!picking.value) return []
  const wantGk = picking.value === 'gk'
  return ownedIds().filter(id => (BY_ID[id].class === 'gk') === wantGk)
})
function usedElsewhere (id) {
  return Object.entries(draft.value).some(([k, v]) => k !== picking.value && v === id)
}
function choose (id) {
  const slot = picking.value
  const clash = Object.entries(draft.value).find(([k, v]) => k !== slot && v === id)
  const d = { ...draft.value }
  if (clash) d[clash[0]] = d[slot]          // swap instead of blocking
  d[slot] = id
  draft.value = d
  picking.value = null
}
function autoPlace () {
  const three = [draft.value.fw, draft.value.mf, draft.value.df]
  const best = bestPlacement(draft.value.gk, three)
  if (best) draft.value = best.deck
}
function save () { store.deck = { ...draft.value }; go('home') }
</script>

<style scoped>
.de { display: flex; flex-direction: column; gap: 12px; }
.power { display: flex; justify-content: space-between; align-items: center; padding: 12px; gap: 14px; }
.lean { flex: 0 0 140px; }
.lean-bar { position: relative; height: 5px; background: var(--surface-hi); border-radius: 999px; margin: 6px 0 4px; }
.lean-bar i { position: absolute; top: -3px; width: 11px; height: 11px; border-radius: 50%; background: var(--green); transform: translateX(-50%); }
.lean-lbl { font-size: 10px; text-align: center; }
.slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.slot { cursor: pointer; }
.slot-lbl { font-size: 9px; color: var(--text-2); text-align: center; margin-bottom: 4px; font-weight: 700; }
.slot.active .slot-lbl { color: var(--cta); }
.picker { background: var(--surface-lo); border-radius: var(--r-md); padding: 10px; }
.pick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
</style>
