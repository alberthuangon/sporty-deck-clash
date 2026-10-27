<template>
  <div class="dr" :class="draw.won ? 'won' : 'lost'">
    <div class="dr-in">
      <div class="dr-kicker">SEASON {{ draw.season }} · DRAW RESULT</div>

      <!-- Only the headline and the celebration differ between winning and
           losing (§6.7.2). The prize block is reserved in BOTH so the figures
           below line up to the pixel — a mirror that only mirrors the words
           is not a mirror. The amount itself appears on a win only: showing
           someone the money they did not win is a second injury, and sits on
           the edge of the near-miss framing this product refuses. -->
      <h2 class="dr-title">{{ draw.won ? 'You won the grand prize' : 'Not this time' }}</h2>
      <div class="dr-prize">
        <CountUp v-if="draw.won" :value="draw.prize" :animate="animate" prefix="₦" :duration="1.1" />
      </div>

      <div class="dr-rows card">
        <div class="dr-row">
          <span class="muted">Your tickets</span>
          <span class="dr-v">{{ draw.myTickets }} of {{ draw.totalTickets.toLocaleString() }}</span>
        </div>
        <div class="dr-row">
          <span class="muted">Your odds were</span>
          <span class="dr-v">{{ odds === null ? '—' : `1 in ${odds.toLocaleString()}` }}</span>
        </div>
        <div class="dr-row last">
          <span class="muted">Winning ticket</span>
          <span class="dr-v">#{{ draw.winningTicket.toLocaleString() }}</span>
        </div>

      </div>

      <div class="dr-next">
        Season {{ draw.season + 1 }} starts now.
        {{ waiting }} tickets waiting on the reward road.
      </div>
      <!-- A takeover still has to be leaveable. Neutral rather than a CTA:
           with no button pointing anywhere, nothing is being sold on the way
           out, which is the most conservative reading of §6.7.2's rule that
           the exit may not push a purchase. -->
      <button class="btn dr-go" @click="dismiss">Close</button>
    </div>

    <div v-if="draw.won" class="dr-burst" ref="burstEl" aria-hidden="true">
      <i v-for="n in 14" :key="n"></i>
    </div>
  </div>
</template>

<script setup>
/* PRD §6.7.2 — the one screen the season's draw gets, win or lose.

   Losing takes over the screen exactly as winning does. That is the point:
   "the draw algorithm is published" is only worth saying if the player is
   shown the same ledger on the day it did not go their way. */
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import CountUp from '../components/CountUp.vue'
import { store, ticketsWaiting } from '../game.js'

const props = defineProps({ animate: { type: Boolean, default: true } })

const draw = computed(() => store.jackpot.lastDraw)
const odds = computed(() => (draw.value.myTickets ? Math.round(draw.value.totalTickets / draw.value.myTickets) : null))
const waiting = computed(() => ticketsWaiting())
const burstEl = ref(null)
let tl = null

function dismiss () {
  store.flags.seenDraw = draw.value.season   // opened: the card stops being an envelope
  store.overlay = null
}

/* Stands in for the rank-up burst until step 6 builds the real one; it plays
   once and stops, like the full-time card it is modelled on.

   Keyed on the draw rather than on mount: the shards are behind v-if="won",
   so a component that mounted on a losing draw and then saw a winning one
   would have run its animation against nothing. That is the same mistake the
   goal cut-in made — compile first, element second. */
function playBurst () {
  if (tl) { tl.kill(); tl = null }
  if (!draw.value || !draw.value.won || !props.animate || !burstEl.value) return
  const bits = burstEl.value.children
  gsap.set(bits, { clearProps: 'all' })
  tl = gsap.timeline()
  tl.fromTo(bits,
    { scale: 0, opacity: 1 },
    {
      scale: 1, opacity: 0, duration: 1.1, ease: 'power2.out', stagger: 0.03,
      x: i => Math.cos((i / bits.length) * Math.PI * 2) * 150,
      y: i => Math.sin((i / bits.length) * Math.PI * 2) * 150
    })
}

/* onMounted for the normal case, and a watcher for the case where this
   component is already up when the draw arrives — `immediate` is no use here,
   it runs during setup when the shards do not exist yet. */
onMounted(playBurst)
watch(() => draw.value && draw.value.won, playBurst, { flush: 'post' })
onUnmounted(() => { if (tl) tl.kill() })
</script>

<style scoped>
/* a takeover: above the top bar and the tab bar, both of which sit at 20 */
.dr {
  position: absolute; inset: 0; z-index: 60;
  background: var(--bg);
  display: flex; flex-direction: column;
  overflow-y: auto;
}
.dr.won { background: radial-gradient(120% 60% at 50% 12%, #123021, var(--bg) 70%); }
.dr-in {
  padding: 28px 16px 20px; flex: 1;
  display: flex; flex-direction: column; justify-content: safe center;
}
/* One block, centred, the way the full-time card this is modelled on sits.
   Top-anchoring left ~440px of nothing in the middle of the screen, and
   centring only the ledger split that into two smaller voids. `safe` on the
   container so content taller than the frame starts at the top and keeps its
   head rather than being centred out of view. */
.dr-kicker {
  font-size: 10px; font-weight: 800; letter-spacing: .18em;
  color: var(--text-2); text-align: center;
}
.dr-title {
  font-size: 24px; line-height: 1.15; text-align: center;
  margin-top: 10px; min-height: 56px;
  display: flex; align-items: center; justify-content: center;
}
.dr.won .dr-title { color: var(--cta); }
/* reserved in both states so the ledger below never moves */
.dr-prize {
  min-height: 42px; font-size: 32px; font-weight: 800; color: var(--r-l);
  text-align: center; line-height: 42px;
}
.dr-rows { padding: 4px 14px; margin-top: 14px; }
.dr-row {
  display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  font-size: 13px; padding: 9px 0; border-bottom: 1px solid var(--divider);
}
.dr-row.last { border-bottom: 0; }
.dr-v { font-weight: 700; font-variant-numeric: tabular-nums; }
.dr-next { font-size: 12px; line-height: 1.5; text-align: center; margin: 18px 4px 12px; color: var(--text-2); }
.dr-go { margin-top: 22px; flex: 0 0 auto; }

.dr-burst { position: absolute; left: 50%; top: 32%; pointer-events: none; }
.dr-burst i {
  position: absolute; width: 8px; height: 8px; margin: -4px;
  border-radius: 2px; background: var(--cta);
}
</style>
