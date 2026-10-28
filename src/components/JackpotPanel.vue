<template>
  <section class="jp" aria-label="Season jackpot">
    <img class="jp-trophy" :src="trophyArt" width="256" height="384" alt="" aria-hidden="true" decoding="async">
    <div class="jp-head">
      <h2 class="jp-title">Season Jackpot</h2>
      <span class="draw-countdown">{{ countdown }}</span>
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
        <button class="jp-link" :class="{ sealed }" @click="$emit('last-season')">
          {{ lastLabel }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
/* PRD §6.7.1, with Albert's call that the standing state lives in ONE place
   rather than split across Home and Rank. The full version moved here rather
   than the light one surviving: dropping the card from Rank must not drop the
   odds out of the app, which §6.7 asks to be available at any time. */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import trophyArt from '../assets/play-art/trophy.webp'
import CountUp from './CountUp.vue'
import { store, grandPrizeOdds, timeToDraw, drawIsSealed } from '../game.js'

defineEmits(['last-season'])

const total = computed(() => store.jackpot.totalTickets.toLocaleString())
const odds = computed(() => grandPrizeOdds())
/* Sealed reads as something to do; opened reads as something that happened. */
const sealed = computed(() => drawIsSealed())
const lastLabel = computed(() =>
  sealed.value
    ? 'Open last season\u2019s draw ›'
    : (store.jackpot.lastDraw.won ? 'Last season: you won ›' : 'Last season: no win ›'))

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
.jp { position:relative; isolation:isolate; overflow:hidden; padding:12px; border:1px solid #a8874c; border-radius:10px; background:radial-gradient(ellipse at 100% 25%,#6d4e2722,transparent 65%),linear-gradient(125deg,#272a2d,#1e252e); }
.jp::before { content:''; position:absolute; inset:0; z-index:-1; background:linear-gradient(90deg,#20252df2 30%,#20252dc9 70%,#20252d55),url('../assets/rank-art/stadium.webp') center / cover; }
.jp-trophy { object-fit:contain; pointer-events:none; position:absolute; right:4px; top:37px; width:98px; height:137px; z-index:-1; opacity:.72; }
.jp-head { display:flex; justify-content:space-between; align-items:center; gap:7px; }
.jp-title { font-size:13px; text-transform:uppercase; letter-spacing:.02em; border-left:3px solid #e4bd67; padding-left:7px; }
.draw-countdown { font-size:10px; white-space:nowrap; border:1px solid #7d8591; border-radius:7px; padding:4px 7px; color:#e1e5eb; background:#1f252dcc; }
.jp-pool { color:#f3cc66; font-size:32px; font-weight:800; letter-spacing:-.03em; line-height:1.2; margin-top:6px; font-variant-numeric:tabular-nums; white-space:nowrap; text-shadow:0 1px 10px #0006; }
.jp-rows { position:relative; margin-top:8px; border-top:1px solid #c69c4e55; padding-top:6px; }
.jp-row { display:flex; justify-content:space-between; align-items:baseline; gap:8px; font-size:12px; padding:3px 0; }
.jp-row .muted { color:#c0c7d1; }
.jp-n { font-weight:700; white-space:nowrap; font-variant-numeric:tabular-nums; text-shadow:0 1px 5px #000; }
.of { font-weight:400; font-size:11px; }
.jp-minor { font-size:10px; margin-top:3px; color:#b8c1ce; }
.jp-cta { margin:3px 0 0; }
.jp-link { display:block; width:100%; min-height:44px; text-align:left; font-size:12px; font-weight:700; color:#c6ced9; }
.jp-link.sealed { color:#68ec93; }
.jp-link:focus-visible { outline:2px solid var(--cta); outline-offset:2px; border-radius:3px; }
@media(max-width:370px) { .jp { padding:12px; } .jp-title { font-size:11px; } .draw-countdown { font-size:9px; padding:4px 5px; } .jp-pool { font-size:28px; } .jp-trophy { width:80px; right:4px; opacity:.45; } .jp-row { font-size:11px; } }
</style>
