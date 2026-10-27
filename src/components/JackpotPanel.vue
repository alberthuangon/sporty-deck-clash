<template>
  <div class="jp card">
    <div class="jp-head">
      <span class="muted lbl">Season Jackpot</span>
      <span class="muted lbl">{{ countdown }}</span>
    </div>
    <div class="jp-pool">₦<CountUp :value="livePool" :from="store.jackpot.pool" :duration="0.8" /></div>

    <div class="jp-rows">
      <div class="jp-row">
        <span class="muted">Your tickets</span>
        <span class="jp-n">{{ store.tickets }}<span class="muted of">&nbsp;of {{ total }}</span></span>
      </div>

      <!-- grand prize only, never blended with the diamond prizes (§6.7.3) -->
      <div class="jp-row">
        <span class="muted">Grand prize odds</span>
        <span class="jp-n">{{ odds === null ? '—' : `1 in ${odds.toLocaleString()}` }}</span>
      </div>
      <div class="muted jp-minor">+ diamond prizes for more winners</div>

      <div class="jp-cta">
        <button class="jp-link" @click="$emit('last-season')">
          {{ lastLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/* PRD §6.7.1, with Albert's call that the standing state lives in ONE place
   rather than split across Home and Rank. The full version moved here rather
   than the light one surviving: dropping the card from Rank must not drop the
   odds out of the app, which §6.7 asks to be available at any time. */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import CountUp from './CountUp.vue'
import { store, grandPrizeOdds, timeToDraw } from '../game.js'

defineEmits(['last-season'])

const total = computed(() => store.jackpot.totalTickets.toLocaleString())
const odds = computed(() => grandPrizeOdds())
const lastLabel = computed(() =>
  store.jackpot.lastDraw
    ? (store.jackpot.lastDraw.won ? 'Last season: you won ›' : 'Last season: no win ›')
    : 'View last season ›')

/* The pool is fed by every table's rake, so it climbs while you look at it.
   Local to the view: writing each tick into the store would rewrite the whole
   save to localStorage twice a second for a number nobody needs persisted to
   the rupee. */
const drift = ref(0)
const livePool = computed(() => store.jackpot.pool + drift.value)

const now = ref(Date.now())
const countdown = computed(() => timeToDraw(now.value))

let pulse, clock
onMounted(() => {
  pulse = setInterval(() => { drift.value += 1 + Math.floor(Math.random() * 40) }, 900)
  clock = setInterval(() => { now.value = Date.now() }, 30000)
})
onUnmounted(() => { clearInterval(pulse); clearInterval(clock) })
</script>

<style scoped>
.jp { padding: 12px; }
.lbl { font-size: 11px; }
.jp-head { display: flex; justify-content: space-between; align-items: baseline; }
.jp-pool {
  font-size: 26px; font-weight: 800; color: var(--r-l);
  font-variant-numeric: tabular-nums; line-height: 1.15; margin-top: 2px;
}
.jp-rows { margin-top: 10px; border-top: 1px solid var(--divider); padding-top: 8px; }
.jp-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; padding: 3px 0; }
.jp-n { font-weight: 800; font-variant-numeric: tabular-nums; }
.of { font-weight: 400; font-size: 12px; }
.jp-minor { font-size: 10px; margin-top: 2px; }
.jp-cta { display: flex; align-items: center; margin: 0 -12px -12px; }
.jp-link { padding: 15px 12px; color: var(--green); font-size: 12px; font-weight: 700; }
</style>
