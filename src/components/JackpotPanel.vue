<template>
  <div class="jp card">
    <div class="jp-head">
      <span class="muted lbl">Season Jackpot</span>
      <span class="muted lbl">{{ countdown }}</span>
    </div>
    <div class="jp-pool">₦{{ pool }}</div>

    <div class="jp-rows">
      <div class="jp-row">
        <span class="muted">Your tickets</span>
        <span class="jp-n">{{ store.tickets }}<span
          v-if="full" class="muted of">&nbsp;of {{ total }}</span></span>
      </div>

      <template v-if="full">
        <!-- grand prize only, never blended with the diamond prizes (§6.7.3) -->
        <div class="jp-row">
          <span class="muted">Grand prize odds</span>
          <span class="jp-n">{{ odds === null ? '—' : `1 in ${odds.toLocaleString()}` }}</span>
        </div>
        <div class="muted jp-minor">+ diamond prizes for more winners</div>
        <button class="jp-more" @click="$emit('earn-more')">Earn more ›</button>
      </template>

      <!-- the draw's only lasting trace, and only on the home screen (§6.7.1) -->
      <div v-else-if="store.jackpot.lastDraw" class="muted jp-last">
        Last season: {{ store.jackpot.lastDraw.won ? 'You won the grand prize' : 'Not this time' }}
      </div>
    </div>
  </div>
</template>

<script setup>
/* PRD §6.7.1. The standing state, at two densities: the home screen carries
   the pool, the countdown, my tickets and the one-line result of the last
   draw; the rank screen carries the full version with the odds, because the
   odds number is heavy and belongs where the tickets come from. */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { store, grandPrizeOdds, timeToDraw } from '../game.js'

const props = defineProps({ variant: { type: String, default: 'home' } })
defineEmits(['earn-more'])

const full = computed(() => props.variant === 'rank')
const pool = computed(() => store.jackpot.pool.toLocaleString())
const total = computed(() => store.jackpot.totalTickets.toLocaleString())
const odds = computed(() => grandPrizeOdds())

/* re-read the clock on a timer rather than once, so a screen left open does
   not keep claiming "Draw in 6 days" into the next day */
const now = ref(Date.now())
const countdown = computed(() => timeToDraw(now.value))
let timer
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 30000) })
onUnmounted(() => clearInterval(timer))
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
.jp-last { font-size: 11px; margin-top: 6px; }
.jp-more {
  display: block; margin: 0 -12px -12px auto; padding: 15px 12px;
  color: var(--green); font-size: 12px; font-weight: 700;
}
</style>
