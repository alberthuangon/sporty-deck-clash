<template>
  <div class="scroll pad po">
    <!-- stage 1: sealed pack, swipe to tear (grey-box: a button stands in for
         the gesture until step 6) -->
    <div v-if="stage === 'sealed'" class="stage">
      <div class="seal">
        <div class="seal-top">{{ pack.name }}</div>
        <div class="seal-mid">◆ {{ pack.price }}</div>
        <div class="seal-hint muted">pull to tear</div>
      </div>
      <button class="btn btn-cta" data-sfx="tear" @click="tear">Tear open</button>
    </div>

    <!-- stage 2: reveal cards one at a time -->
    <div v-else-if="stage === 'reveal'" class="stage">
      <div class="counter muted">{{ index + 1 }} / {{ pulls.length }}</div>
      <!-- always present, empty until the last card: appearing mid-reveal used
           to drop the card, the verdict and the button 31px down the screen -->
      <div class="glow">{{ index === pulls.length - 1 ? '✦ final card ✦' : '' }}</div>

      <CardFace ref="cardRef" :card="currentCard" size="lg" class="reveal-card" />

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
    <div v-else class="stage">
      <h3 class="sum-h">Pack summary</h3>
      <div class="sum-grid">
        <CardFace v-for="(p,i) in pulls" :key="i" :card="cardFor(p)" size="sm" :radar="false">
          <span class="tag" :class="p.isNew ? 'tn' : 'td'">{{ p.isNew ? 'NEW' : '+1' }}</span>
        </CardFace>
      </div>
      <div v-if="upgradable.length" class="up-note">
        <div class="up-t">{{ upgradable.length }} card ready to upgrade</div>
        <button class="btn btn-cta" @click="goUpgrade(upgradable[0])">
          Upgrade {{ BY_ID[upgradable[0]].name }}
        </button>
      </div>
      <button class="btn" @click="go('shop')">Back to shop</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import CardFace from '../components/CardFace.vue'
import { flyTo } from '../ui/flyIn.js'
import { store, go, buyPack, commitPull, entry, canUpgrade, upgradeCost, BY_ID } from '../game.js'
import { buildCard } from '../engine/cards.js'
import { PACKS } from '../engine/economy.js'

const pack = PACKS.find(p => p.id === (store.pendingPack || 'standard'))
const stage = ref('sealed')
const index = ref(0)
const pulls = ref([])
const upgradable = ref([])
const cardRef = ref(null)
const shardLine = ref(null)

onMounted(() => {
  const res = buyPack(pack)
  if (!res) { go('shop'); return }
  pulls.value = res
})

const current = computed(() => pulls.value[index.value] || {})
const currentCard = computed(() => buildCard(current.value.def, Math.max(1, entry(current.value.id).level)))
const shardText = computed(() => {
  const e = entry(current.value.id)
  const cost = upgradeCost(current.value.id)
  return cost ? `${e.shards} / ${cost} shards` : `${e.shards} shards`
})

function cardFor (p) { return buildCard(p.def, Math.max(1, entry(p.id).level)) }

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

function tear () {
  stage.value = 'reveal'
  index.value = 0
  commitPull(pulls.value[0])
  shardFlight()
}
function next () {
  if (index.value === pulls.value.length - 1) {
    upgradable.value = pulls.value.map(p => p.id).filter(id => canUpgrade(id))
    store.flags.packOpened = true
    stage.value = 'summary'
    return
  }
  index.value += 1
  commitPull(pulls.value[index.value])
  shardFlight()
}
function goUpgrade (id) { store.upgradeTarget = id; go('upgrade') }
</script>

<style scoped>
.po { align-items: center; }
.stage { display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 10px; }
.seal {
  width: 190px; height: 260px; border-radius: 10px;
  background: linear-gradient(160deg, #3B4150, #22252D);
  border: 1px solid var(--divider);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
}
.seal-top { font-weight: 800; letter-spacing: .06em; }
.seal-mid { color: #6EE7FF; font-weight: 700; }
.seal-hint { font-size: 11px; }
.counter { font-size: 12px; }
.glow { color: var(--r-l); font-weight: 700; font-size: 13px; letter-spacing: .08em; line-height: 18px; min-height: 18px; }
.reveal-card { width: 190px; }
.verdict { text-align: center; font-size: 12px; }
.new-tag { color: var(--cta); font-weight: 800; letter-spacing: .08em; margin-bottom: 3px; }
.dup-tag { color: var(--text-2); font-weight: 800; letter-spacing: .06em; margin-bottom: 3px; }
.sum-h { font-size: 15px; }
.sum-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
.tag { font-size: 8px; font-weight: 800; margin-top: 3px; }
.tn { color: var(--cta); } .td { color: var(--text-2); }
.up-note { width: 100%; background: var(--surface); border: 1px solid var(--cta-deep); border-radius: var(--r-md); padding: 12px; text-align: center; }
.up-t { font-size: 13px; font-weight: 700; margin-bottom: 10px; }
.stage > .btn { width: 190px; }
</style>
