<template>
  <div class="scroll pad po">
    <!-- stage 1: the sealed pack. The tear itself lives in SealTear so the
         motion lab can replay it while its slider moves. -->
    <div v-if="stage === 'sealed'" class="stage">
      <SealTear ref="sealRef" :title="pack.name" :price="pack.price" :tier="pack.id" @torn="revealFirst" />
      <button class="btn btn-cta" data-sfx="tear" @click="tear">Tear open</button>
    </div>

    <!-- stage 2: reveal cards one at a time -->
    <div v-else-if="stage === 'reveal'" class="stage">
      <div class="counter muted">{{ index + 1 }} / {{ pulls.length }}</div>
      <!-- always present, empty until the last card: appearing mid-reveal used
           to drop the card, the verdict and the button 31px down the screen -->
      <div class="glow">{{ index === pulls.length - 1 ? '✦ final card ✦' : '' }}</div>

      <!-- The reveal is the other place a card is LOOKED AT rather than found
           (holo spec §261: lg only), so it gets the same finish as the detail
           hero. The wrapper carries the tilt; the ref stays on the CardFace so
           the shard flight still measures the card and not the perspective box. -->
      <HoloCard>
        <CardFace ref="cardRef" :card="currentCard" size="lg" :radar="false" full foil class="reveal-card" />
      </HoloCard>

      <div class="verdict">
        <template v-if="current.isNew">
          <div class="new-tag">NEW CARD</div>
          <div class="muted">{{ currentCard.name }} joins your collection</div>
        </template>
        <template v-else>
          <div class="dup-tag">DUPLICATE → +1 SHARD</div>
          <div class="muted" ref="shardLine">
            {{ currentCard.name }} {{ shardText }}
          </div>
        </template>
      </div>

      <button class="btn btn-cta" @click="next">
        {{ index === pulls.length - 1 ? 'See summary' : 'Next card' }}
      </button>
    </div>

    <!-- stage 3: summary -->
    <!-- stage 4: one of the five, full size. A stage rather than an overlay:
         the screen already is a sequence of stages, and an overlay would owe
         the gate a takeover's promises for no gain. -->
    <div v-else-if="viewing !== null" class="stage">
      <HoloCard class="viewed">
        <CardFace :card="cardFor(viewed)" size="lg" :radar="false" full foil />
      </HoloCard>
      <!-- THE SHORTCUT LIVES HERE NOW. It used to sit under the summary and
           offered only the FIRST upgradable card, so a pack that produced two
           had no way to reach the second. Attached to the card being looked
           at, every one of them has a door. -->
      <button v-if="canUpgrade(viewed.id)" class="btn btn-cta" @click="goUpgrade(viewed.id)">
        Upgrade {{ BY_ID[viewed.id].name }}
      </button>
      <button class="btn" @click="viewing = null">Back to summary</button>
    </div>

    <!-- stage 3: summary -->
    <div v-else class="stage">
      <h3 class="sum-h">Pack summary</h3>
      <div class="sum-grid">
        <!-- A TAP IS ALWAYS "LOOK", never "upgrade". Five cards that respond
             differently depending on whether they happen to carry a dot would
             make the dot a control; it is a mark, exactly as it is in the
             collection, where it also sits top-right and also means only
             "there is something to do with this one". -->
        <div v-for="(p,i) in pulls" :key="i" class="sum-slot" @click="viewing = i">
          <CardFace :card="cardFor(p)" size="sm" full
                    :class="{ 'is-new': p.isNew }" :sub="p.isNew ? 'NEW' : '+1 shard'" />
          <i v-if="canUpgrade(p.id)" class="dot"></i>
        </div>
      </div>
      <button class="btn" @click="go('shop')">Back to shop</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import CardFace from '../components/CardFace.vue'
import SealTear from '../components/SealTear.vue'
import HoloCard from '../components/HoloCard.vue'
import { flyTo } from '../ui/flyIn.js'
import { artFor } from '../ui/art.js'
import { store, go, canUpgrade, BY_ID } from '../game.js'
import { screenBack } from '../store.js'
import { buildCard } from '../engine/cards.js'
import { PACKS } from '../engine/economy.js'

const pack = PACKS.find(p => p.id === (store.pendingPack || 'standard'))
const stage = ref('sealed')
const index = ref(0)
const pulls = ref([])
const viewing = ref(null)
const cardRef = ref(null)
const shardLine = ref(null)
const sealRef = ref(null)

/* NOTHING IS BOUGHT HERE ANY MORE.

   The five cards were paid for and handed over in the Shop, in one act (see
   purchasePack). What arrives here is a RECORD of that — what each card was
   as it landed — and this screen performs it. The consequence worth stating:
   there is no longer any window between paying and receiving for a back
   button, a tab, or a reload to fall into, because there is no longer a gap.

   Consumed on arrival. A record left lying in the store would replay a pack
   the player has already seen the next time anything navigated here. */
onMounted(() => {
  const res = store.pendingPulls
  if (!res || !res.length) { go('shop'); return }
  pulls.value = res
  store.pendingPulls = null
  /* The five cards are already decided, several seconds before the pack is
     torn — the tear is the only place in the app where an animation is
     allowed to gate information, and that pause is free decoding time. The
     reveal is the one screen where the card IS the moment, so a picture
     arriving late is the moment arriving late. Fire and forget: nothing waits
     on these, they only warm the cache. */
  for (const p of res) {
    const url = artFor(p.id, 'figure')
    if (url) { const img = new Image(); img.decoding = 'async'; img.src = url }
  }
})

/* looking at one of the five full size leaves the summary before it leaves
   the screen, the same bargain the collection's detail view makes */
watch(viewing, v => { screenBack.value = v === null ? null : () => { viewing.value = null } }, { immediate: true })
onUnmounted(() => { screenBack.value = null })

const current = computed(() => pulls.value[index.value] || {})
/* EVERY number here comes off the record, not off the store. The store holds
   the final state of all five; this screen is replaying a moment, and reading
   live state would make the first card announce what the fifth produced. */
const currentCard = computed(() => cardFor(current.value))
const shardText = computed(() =>
  current.value.cost ? `${current.value.shards} / ${current.value.cost} shards` : `${current.value.shards} shards`)
const viewed = computed(() => (viewing.value === null ? null : pulls.value[viewing.value]))

function cardFor (p) { return p && p.id ? buildCard(BY_ID[p.id], Math.max(1, p.level)) : null }

/* A duplicate pays a shard, and the count on the line below is where it
   lands. nextTick first: on the very first card the reveal stage has not
   rendered yet, and an animation built against an element that does not
   exist is the mistake this repo has shipped three times. */
function shardFlight () {
  if (current.value.isNew) return
  nextTick(() => {
    const card = cardRef.value && cardRef.value.$el
    if (card && shardLine.value) flyTo(card, shardLine.value, { glyph: '◈', count: 4, colour: 'var(--text-2)' })
  })
}

/* The card is SHOWN at the end of the tear. It was granted in the Shop; what
   the tear still gates is knowing which five, which is the whole point of a
   sealed pack (§2.1). */
function tear () { if (sealRef.value) sealRef.value.tear() }
function revealFirst () {
  stage.value = 'reveal'
  index.value = 0
  shardFlight()
}
function next () {
  if (index.value === pulls.value.length - 1) { stage.value = 'summary'; return }
  index.value += 1
  shardFlight()
}
function goUpgrade (id) { store.upgradeTarget = id; go('upgrade') }
</script>

<style scoped>
.po { align-items: center; }
.stage { display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 10px; }
.counter { font-size: 12px; }
.glow { color: var(--r-l); font-weight: 700; font-size: 13px; letter-spacing: .08em; line-height: 18px; min-height: 18px; }
/* 320: the reveal stage had the most room of any screen in the app and was
   using the least. Measured — stage 364.6 -> 627.6 in an 884px scroller, zero
   overflow, 244px still under the button. */
.reveal-card { width: 320px; }
.verdict { text-align: center; font-size: 12px; }
.new-tag { color: var(--cta); font-weight: 800; letter-spacing: .08em; margin-bottom: 3px; }
.dup-tag { color: var(--text-2); font-weight: 800; letter-spacing: .06em; margin-bottom: 3px; }
.sum-h { font-size: 15px; }
.sum-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
/* the dot is positioned against this, and the cell has to stretch so three
   cards in a row cannot end up different heights */
.sum-slot { position: relative; cursor: pointer; display: flex; }
.sum-slot > .cf { flex: 1; min-width: 0; }
/* NEW takes the line the role was using, which is where the card already has
   a second line and where nothing competes with the dot. Green because this
   product's green means won/gained everywhere else; a duplicate's shard line
   stays neutral, because a duplicate is not a loss but it is not news. */
.sum-slot :deep(.is-new .cf-role) { color: var(--cta); font-weight: 800; letter-spacing: .04em; }
.viewed { width: 280px; }
.viewed :deep(.cf) { width: 100%; }
.stage > .btn { width: 320px; }
</style>
