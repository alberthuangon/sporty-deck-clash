<template>
  <div class="scroll pad po">
    <!-- stage 1: the sealed pack. A TAP, not a drag: a real gesture can only
         be judged by feel, and the one person who has to sign this off is
         usually not at the machine. A tap reads almost the same on stage and
         can be photographed frame by frame.

         The two halves are always in the DOM and always carry the same
         content, clipped to the top and bottom of the rip. Nothing here is
         behind a v-if the animation depends on. -->
    <div v-if="stage === 'sealed'" class="stage">
      <div class="seal" ref="sealEl" @click="tear">
        <div class="seal-half top" ref="tearA">
          <div class="seal-in">
            <div class="seal-top">{{ pack.name }}</div>
            <div class="seal-mid">◆ {{ pack.price }}</div>
            <div class="seal-hint muted">tap to tear</div>
          </div>
        </div>
        <div class="seal-half bot" ref="tearB">
          <div class="seal-in">
            <div class="seal-top">{{ pack.name }}</div>
            <div class="seal-mid">◆ {{ pack.price }}</div>
            <div class="seal-hint muted">tap to tear</div>
          </div>
        </div>
        <div class="seal-rip" ref="ripEl"></div>
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import CardFace from '../components/CardFace.vue'
import { flyTo } from '../ui/flyIn.js'
import { uiPlay, UI_TIME } from '../ui/motion.js'
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
const sealEl = ref(null)
const tearA = ref(null)
const tearB = ref(null)
const ripEl = ref(null)
let anim = null
let alive = true

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

/* The card is granted and shown at the END of the tear, never before — the
   one place in step 6 where the animation is allowed to gate information,
   because the whole point of a sealed pack is not knowing yet (§2.1).

   A second tap during the tear skips it rather than starting another. That
   matters more here than anywhere else: a pack is opened dozens of times in
   a session, and the second one is already too slow. */
function tear () {
  if (anim && !anim.record.done) { anim.skip(); return }
  if (stage.value !== 'sealed') return
  const d = UI_TIME.tear
  anim = uiPlay('tear', tl => {
    tl.fromTo(ripEl.value, { opacity: 0, scaleX: 0.2 },
      { opacity: 1, scaleX: 1, duration: d * 0.18, ease: 'power2.out' }, 0)
    tl.to(sealEl.value, { scale: 0.96, duration: d * 0.12, ease: 'power2.out' }, 0)
    tl.to(sealEl.value, { scale: 1, duration: d * 0.18, ease: 'power2.inOut' }, d * 0.12)
    /* The halves land exactly ON the dial: `tear` is "tap -> first card
       visible", so a timeline that finishes early makes the number a
       decoration and MotionLab's slider a lie.

       power1.in rather than power2.in. The steeper ease was truer to how
       paper gives way, and it spent the first 0.4s of a 0.92s animation
       looking like nothing was happening — on the one screen a player
       revisits dozens of times a session. They also recede as they go, so
       the bottom half stops sliding across the button underneath it. */
    tl.to(tearA.value, { y: -70, x: -16, rotate: -9, scale: 0.94, duration: d * 0.84, ease: 'power1.in' }, d * 0.16)
    tl.to(tearB.value, { y: 56, x: 14, rotate: 7, scale: 0.94, duration: d * 0.84, ease: 'power1.in' }, d * 0.16)
    tl.to([tearA.value, tearB.value], { opacity: 0, duration: d * 0.5, ease: 'power1.in' }, d * 0.5)
    tl.to(ripEl.value, { opacity: 0, scaleY: 3.4, duration: d * 0.4, ease: 'power2.out' }, d * 0.4)
  }, {
    interruptible: true,
    onEnd: () => {
      if (!alive) return
      stage.value = 'reveal'
      index.value = 0
      commitPull(pulls.value[0])
      shardFlight()
    }
  })
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

onUnmounted(() => { alive = false; if (anim) anim.cancel() })
</script>

<style scoped>
.po { align-items: center; }
.stage { display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 10px; }
.seal { position: relative; width: 190px; height: 260px; cursor: pointer; }
/* Two layers holding the SAME content, each clipped to its side of the rip,
   so the pack reads as one card until it stops being one. The clip line and
   the two insets have to add up to 100% or the seam shows. */
.seal-half {
  position: absolute; inset: 0; border-radius: 10px;
  background: linear-gradient(160deg, #3B4150, #22252D);
  border: 1px solid var(--divider);
}
.seal-half.top { clip-path: inset(0 0 56% 0); }
.seal-half.bot { clip-path: inset(44% 0 0 0); }
.seal-in {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
}
.seal-rip {
  position: absolute; left: -6px; right: -6px; top: 44%;
  height: 3px; background: var(--cta); opacity: 0;
  box-shadow: 0 0 12px 3px var(--cta);
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
