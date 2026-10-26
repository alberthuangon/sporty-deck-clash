<template>
  <div class="scroll pad hm">
    <div class="squad card">
      <div class="sq-head">
        <div>
          <div class="muted lbl">Squad Power</div>
          <PowerStars :q="power" />
        </div>
        <div class="venue">
          <div class="muted lbl">{{ leanLabel }}</div>
          <div class="vbar"><i :style="{ left: (50 + lean * 900) + '%' }"></i></div>
        </div>
      </div>
      <div class="lineup">
        <div v-for="s in SLOTS" :key="s.key" class="lu">
          <div class="lu-lbl">{{ s.short }}</div>
          <CardFace :card="cardOf(store.deck[s.key])" size="sm" :radar="false" />
        </div>
      </div>
      <button class="btn edit" @click="go('deckedit')">Edit squad</button>
    </div>

    <button class="btn btn-cta big" data-sfx="start" @click="go('tierselect')">Start match</button>

    <div class="tiers card">
      <div class="sec-title" style="margin-bottom:8px">Arenas</div>
      <div v-for="t in TIERS" :key="t.id" class="trow">
        <span class="tf">₦{{ t.fee }}</span>
        <span class="tn muted">{{ t.name }}</span>
        <span v-if="unlocked(t)" class="ok">✓</span>
        <span v-else class="lock muted">🔒 Raise your Power to unlock</span>
      </div>
    </div>

    <div class="recent card" v-if="store.history.length">
      <div class="rc-head">
        <span class="sec-title" style="margin:0">Recent matches</span>
        <button class="rc-all" @click="go('history')">All ›</button>
      </div>
      <div v-for="m in store.history.slice(0, 3)" :key="m.id" class="rc-row" @click="go('history')">
        <i class="rc-dot" :class="m.won ? 'w' : 'l'"></i>
        <span class="rc-sc">{{ m.homeScore }}:{{ m.awayScore }}</span>
        <span class="rc-opp muted">{{ m.opponent.handle }}</span>
        <span class="rc-net" :class="m.net >= 0 ? 'up' : 'down'">
          {{ m.net >= 0 ? '+' : '' }}₦{{ Math.abs(m.net).toLocaleString() }}
        </span>
      </div>
    </div>

    <div class="jp card">
      <div>
        <div class="muted lbl">Season Jackpot</div>
        <div class="jp-v">₦{{ jackpot.toLocaleString() }}</div>
      </div>
      <div class="jp-t">
        <div class="muted lbl">Your tickets</div>
        <div class="jp-n">{{ store.tickets }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import CardFace from '../components/CardFace.vue'
import PowerStars from '../components/PowerStars.vue'
import { store, go, cardOf, deckPower, venueLean, collectionPower, TIERS } from '../game.js'

const SLOTS = [
  { key: 'gk', short: 'GK' }, { key: 'df', short: 'DF' },
  { key: 'mf', short: 'MF' }, { key: 'fw', short: 'FW' }
]
const power = computed(() => deckPower())
const lean = computed(() => venueLean())
const leanLabel = computed(() => {
  const v = lean.value * 100
  if (v > 0.4) return 'Home specialist'
  if (v < -0.4) return 'Away specialist'
  return 'Balanced squad'
})
const colPower = computed(() => collectionPower())
function unlocked (t) { return colPower.value >= t.unlockPower }

const jackpot = ref(2847310)
let timer
onMounted(() => { timer = setInterval(() => { jackpot.value += 1 + Math.floor(Math.random() * 40) }, 900) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.hm { display: flex; flex-direction: column; gap: 12px; }
.lbl { font-size: 11px; }
.squad { padding: 12px; }
.sq-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 14px; }
.venue { flex: 0 0 130px; }
.vbar { position: relative; height: 5px; background: var(--surface-hi); border-radius: 999px; margin-top: 7px; }
.vbar i { position: absolute; top: -3px; width: 11px; height: 11px; border-radius: 50%; background: var(--green); transform: translateX(-50%); }
.lineup { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
.lu-lbl { font-size: 9px; font-weight: 700; color: var(--text-2); text-align: center; margin-bottom: 4px; }
.edit { height: 36px; font-size: 13px; }
.big { height: 52px; font-size: 17px; }
.tiers { padding: 12px; }
.trow { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--divider); font-size: 13px; }
.trow:last-child { border-bottom: 0; }
.tf { font-weight: 700; width: 48px; }
.tn { flex: 1; font-size: 12px; }
.ok { color: var(--green); font-weight: 700; }
.lock { font-size: 10px; text-align: right; }
.recent { padding: 12px; }
.rc-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.rc-all { font-size: 11px; color: var(--green); font-weight: 700; }
.rc-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 12px; cursor: pointer; }
.rc-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 7px; }
.rc-dot.w { background: var(--cta); } .rc-dot.l { background: var(--text-3); }
.rc-sc { font-weight: 700; font-variant-numeric: tabular-nums; width: 30px; }
.rc-opp { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-net { font-weight: 700; font-variant-numeric: tabular-nums; }
.rc-net.up { color: var(--green); } .rc-net.down { color: var(--red); }
.jp { display: flex; justify-content: space-between; align-items: center; padding: 12px; }
.jp-v { font-size: 19px; font-weight: 800; color: var(--r-l); font-variant-numeric: tabular-nums; }
.jp-t { text-align: right; }
.jp-n { font-size: 19px; font-weight: 800; }
</style>
