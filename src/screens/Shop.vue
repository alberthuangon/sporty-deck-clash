<template>
  <div class="scroll pad">
    <div v-for="p in PACKS" :key="p.id" class="pack" :class="p.id">
      <div class="pk-art">
        <div class="pk-wrap">{{ p.id === 'gold' ? 'GOLD' : 'STANDARD' }}</div>
        <div class="pk-count">{{ p.cards }} cards</div>
      </div>
      <div class="pk-body">
        <div class="pk-name">{{ p.name }}</div>
        <div class="pk-guar muted">{{ p.guarantee }}</div>
        <button class="odds-link" @click="showOdds = p">View drop rates</button>
        <button class="btn btn-cta buy" :disabled="store.diamonds < p.price" @click="buy(p)">
          <i class="gem">◆</i> {{ p.price }}
        </button>
        <div v-if="store.diamonds < p.price" class="short muted">
          Need {{ p.price - store.diamonds }} more
        </div>
      </div>
    </div>

    <div class="pity card pad">
      <div class="sec-title" style="margin-bottom:6px">Pity counter</div>
      <div class="bar"><i :style="{ width: '40%' }"></i></div>
      <div class="muted" style="font-size:11px;margin-top:6px">
        18 more cards until a guaranteed Epic · 54 until a Legendary
      </div>
    </div>

    <div v-if="showOdds" class="sheet" @click.self="showOdds = null">
      <div class="sheet-in">
        <h3>{{ showOdds.name }} — drop rates</h3>
        <div v-for="o in showOdds.odds" :key="o.rarity" class="orow">
          <span class="ok" :class="'r-'+o.rarity">{{ o.label }}</span>
          <span>{{ o.pct }}%</span>
        </div>
        <p class="muted fine">
          Per-card rates across the whole pack, including the guaranteed slot —
          these are the numbers the draw actually uses.
          Every pack contains {{ showOdds.cards }} cards:
          {{ showOdds.cards - 1 }} open slots plus one slot restricted to
          {{ showOdds.guaranteedFrom.join('/') }}, which is how
          "{{ showOdds.guarantee.split(' ·')[0].toLowerCase() }}" is kept.
        </p>
        <button class="btn" @click="showOdds = null">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { store, go } from '../game.js'
import { PACKS } from '../engine/economy.js'
const showOdds = ref(null)
function buy (p) {
  store.pendingPack = p.id
  go('packopen')
}
</script>

<style scoped>
.pack { display: flex; gap: 12px; background: var(--surface); border-radius: var(--r-md); padding: 12px; margin-bottom: 12px; }
.pk-art {
  width: 104px; flex: 0 0 104px; height: 140px; border-radius: var(--r-sm);
  background: linear-gradient(160deg, #3B4150, #22252D);
  border: 1px solid var(--divider);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
}
.gold .pk-art { background: linear-gradient(160deg, #6B5320, #2B2616); border-color: #A5802E; }
.pk-wrap { font-weight: 800; font-size: 13px; letter-spacing: .08em; }
.pk-count { font-size: 10px; color: var(--text-2); }
.pk-body { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.pk-name { font-weight: 700; font-size: 15px; }
.pk-guar { font-size: 11px; margin: 2px 0 8px; line-height: 1.35; }
.odds-link { color: var(--green); font-size: 11px; text-decoration: underline; text-align: left; margin-bottom: auto; padding-bottom: 10px; }
.buy { gap: 6px; }
.gem { color: #6EE7FF; font-style: normal; }
.short { font-size: 10px; text-align: center; margin-top: 5px; }
.pity .bar { height: 6px; background: var(--surface-hi); border-radius: 999px; overflow: hidden; }
.pity .bar i { display: block; height: 100%; background: var(--green); }
.sheet { position: absolute; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: flex-end; z-index: 40; }
.sheet-in { width: 100%; background: var(--surface); border-radius: 14px 14px 0 0; padding: 16px; }
.sheet-in h3 { font-size: 15px; margin-bottom: 12px; }
.orow { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--divider); font-size: 13px; }
.ok { font-weight: 700; }
.r-C { color: var(--r-c); } .r-R { color: var(--r-r); } .r-E { color: var(--r-e); } .r-L { color: var(--r-l); }
.fine { font-size: 11px; line-height: 1.5; margin: 12px 0; }
</style>
