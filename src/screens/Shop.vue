<template>
  <div class="scroll shop-page">
    <section :inert="!!showOdds" :aria-hidden="showOdds ? true : undefined" class="shop-hero" aria-labelledby="shop-title"><p class="shop-eyebrow">Player packs</p><h1 id="shop-title">Build your collection</h1><div class="hero-sub"><p>5 players in every pack</p><button class="collection-link" @click="go('cards')">{{ ownedCount }} / {{ CATALOGUE.length }} collected <span aria-hidden="true">›</span></button></div></section>
    <div class="shop-body" :inert="!!showOdds" :aria-hidden="showOdds ? true : undefined">
      <section v-for="p in PACKS" :key="p.id" class="pack" :class="p.id" :aria-labelledby="'pack-title-' + p.id">
        <div class="pk-art"><PackArtwork :tier="p.id" /></div>
        <div class="pk-body">
          <div class="pk-title-row"><h2 class="pk-name" :id="'pack-title-' + p.id">{{ p.name }}</h2></div>
          <p class="pk-count">{{ p.cards }} player cards</p>
          <div class="pk-guar" :class="p.id === 'gold' ? 'guarantee-epic' : 'guarantee-rare'"><PackCrest /><span>1 {{ RARITY[p.guaranteedFrom[0]].label }} or better</span></div>
          <p class="guarantee-note">Guaranteed in every pack</p>
          <div class="pack-bonus"><span v-if="p.id === 'gold'">{{ legendaryRate(p) / legendaryRate(PACKS[0]) }}× Legendary rate</span></div>
          <button class="odds-link" :data-odds="p.id" @click="openOdds(p, $event)">View drop rates <span aria-hidden="true">›</span></button>
          <p class="legendary-rate">Legendary: {{ legendaryRate(p) }}% per card</p>
          <button class="btn btn-cta buy" :data-pack="p.id" :disabled="store.diamonds < p.price" :aria-label="`Buy and open ${p.name} for ${p.price} diamonds`" @click="buy(p)"><span>Buy &amp; open</span><span class="buy-price"><DiamondIcon :size="20" class="gem" />{{ p.price }}</span></button>
          <p class="short" aria-live="polite">{{ store.diamonds < p.price ? `Need ${p.price - store.diamonds} more diamonds` : '' }}</p>
        </div>
      </section>
      <section class="pity" aria-labelledby="pity-heading"><div class="pity-head"><h2 id="pity-heading">Pity preview</h2><span class="demo-label">Demo</span></div><div class="pity-examples"><div class="example epic"><PackCrest /><div><h3>Epic</h3><span>18 cards</span></div></div><div class="example legendary"><PackCrest /><div><h3>Legendary</h3><span>54 cards</span></div></div></div><p>Illustrative counters — not live progress.</p></section>
      <p class="duplicate-note"><span aria-hidden="true">ⓘ</span> Duplicate players become upgrade shards.</p>
    </div>
    <div v-if="showOdds" ref="sheet" class="sheet" role="dialog" aria-modal="true" aria-labelledby="odds-heading" @click.self="closeOdds" @keydown.escape.stop.prevent="closeOdds" @keydown.tab="trapFocus">
      <div class="sheet-in"><div class="sheet-handle" aria-hidden="true"></div><p class="shop-eyebrow">Pack probabilities</p><h2 id="odds-heading">{{ showOdds.name }} — drop rates</h2><p class="odds-caption">Average chance per card</p><div v-for="o in showOdds.odds" :key="o.rarity" class="orow"><span class="ok" :class="'rarity-' + o.rarity"><i aria-hidden="true"></i>{{ o.label }}</span><strong>{{ o.pct }}%</strong></div><p class="fine">Every pack contains {{ showOdds.cards }} cards, including one {{ RARITY[showOdds.guaranteedFrom[0]].label }}-or-better guaranteed card. These per-card rates include that guaranteed slot.</p><button ref="closeButton" class="btn close-odds" @click="closeOdds">Close</button></div>
    </div>
  </div>
</template>

<script setup>
import DiamondIcon from '../components/DiamondIcon.vue'
import { ref, computed, nextTick } from 'vue'
import PackCrest from '../components/PackCrest.vue'
import PackArtwork from '../components/PackArtwork.vue'
import { store, go, purchasePack, CATALOGUE, owned, RARITY } from '../game.js'
import { PACKS } from '../engine/economy.js'
const showOdds = ref(null)
const sheet = ref(null)
const closeButton = ref(null)
let oddsTrigger = null
const ownedCount = computed(() => CATALOGUE.filter(c => owned(c.id)).length)
function legendaryRate (p) { return p.odds.find(o => o.rarity === 'L')?.pct || 0 }
function openOdds (pack, event) { oddsTrigger = event.currentTarget; showOdds.value = pack; nextTick(() => closeButton.value?.focus()) }
function closeOdds () { showOdds.value = null; nextTick(() => oddsTrigger?.focus()) }
function trapFocus (event) {
  const buttons = sheet.value?.querySelectorAll('button')
  if (!buttons?.length) return
  const first = buttons[0], last = buttons[buttons.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
function buy (p) {
  const pulls = purchasePack(p)
  if (!pulls) return
  store.pendingPack = p.id
  store.pendingPulls = pulls
  go('packopen')
}
</script>

<style scoped>
.shop-page { background:#191e25; scrollbar-width:thin; scrollbar-color:#505966 transparent; }
.shop-hero { padding:19px 16px 13px; background:linear-gradient(180deg,#16202d22,#191e2522 65%,#191e25),url('../assets/shop-art/stadium.webp') center / cover; }
.shop-eyebrow { margin:0; text-transform:uppercase; font-size:10px; font-weight:700; letter-spacing:.13em; color:#c3cddd; }
.shop-hero h1 { font-size:25px; line-height:1.15; letter-spacing:-.03em; margin-top:6px; text-shadow:0 2px 12px #0008; }
.hero-sub { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.hero-sub p { margin:0; font-size:12px; color:#d3dce8; }
.collection-link { display:flex; align-items:center; justify-content:center; gap:5px; min-height:44px; font-size:10px; color:#dbe3ef; font-weight:600; padding:0 8px; }
.collection-link span { font-size:17px; }
.shop-body { padding:0 14px 14px; display:flex; flex-direction:column; gap:13px; }
.pack { display:flex; align-items:center; gap:10px; min-height:247px; padding:12px 10px; border:1px solid #657d96; border-radius:11px; background:linear-gradient(90deg,#202a3522,#20283155),url('../assets/shop-art/standard-panel.webp') center / cover; overflow:hidden; }
.pack.gold { border-color:#b69a4e; background:linear-gradient(90deg,#2c251333,#24201733),url('../assets/shop-art/gold-panel.webp') center / cover; }
.pk-art { width:44%; flex:0 0 44%; height:244px; }
.pk-body { flex:1; min-width:0; }
.pk-title-row { display:flex; align-items:center; min-height:23px; }
.pk-name { font-size:18px; letter-spacing:-.02em; line-height:23px; }
.pk-count { font-size:11px; color:#d2dbe6; margin:2px 0 9px; }
.pk-guar { display:inline-flex; align-items:center; gap:5px; min-height:28px; padding:4px 7px; border:1px solid currentColor; border-radius:7px; font-size:12px; font-weight:700; line-height:16px; white-space:nowrap; background:#141d2ac9; }
.pk-guar .pack-crest { width:15px; height:17px; }
.guarantee-rare { color:#73baff; --pack-ink:#73baff; }
.guarantee-epic { color:#d59bff; --pack-ink:#d59bff; }
.guarantee-note { font-size:10px; color:#c5cfdd; margin:4px 0 0; line-height:15px; }
.pack-bonus { min-height:22px; margin-top:5px; display:flex; align-items:center; }
.pack-bonus span { color:#f0cc74; border:1px solid #b28d3c; background:#3c301a77; border-radius:6px; padding:2px 6px; font-size:9px; font-weight:700; line-height:14px; }
.odds-link { display:flex; align-items:center; gap:5px; min-height:44px; color:#83ed9f; font-size:12px; font-weight:600; text-decoration:underline; text-underline-offset:3px; }
.odds-link span { font-size:19px; text-decoration:none; }
.legendary-rate { color:#c8d2e0; font-size:10px; margin:-5px 0 10px; line-height:15px; }
.buy { display:flex; justify-content:center; gap:10px; font-size:13px; min-height:44px; background:linear-gradient(110deg,#63ed91,#35d76b); color:#072711; }
.buy-price { display:inline-flex; align-items:center; gap:4px; font-size:17px; font-weight:800; font-variant-numeric:tabular-nums; }
.buy .gem { color:#086b8e; fill:#89e8ff; }
.buy:disabled { color:#c1ccda; background:#2a3340; box-shadow:inset 0 0 0 1px #647183; }
.short { color:#d6c4a3; font-size:9px; line-height:14px; min-height:14px; margin:5px 0 0; text-align:center; }
.pity { padding:13px; border:1px solid #4b5767; border-radius:10px; background:linear-gradient(130deg,#2c343f,#202731); }
.pity-head { display:flex; align-items:center; gap:9px; }
.pity-head h2 { font-size:17px; letter-spacing:-.02em; }
.demo-label { font-size:9px; text-transform:uppercase; font-weight:700; color:#d1d9e6; border:1px solid #718095; border-radius:20px; padding:2px 7px; background:#3d4858; }
.pity-examples { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:11px; }
.example { display:flex; align-items:center; gap:9px; min-height:61px; padding:8px; border:1px solid #725187; border-radius:7px; background:linear-gradient(120deg,#44225266,#252c37); }
.example .pack-crest { width:31px; height:36px; flex:none; }
.example h3 { font-size:13px; margin:0 0 3px; }
.example span { font-size:12px; color:#e4e9f1; }
.epic { color:#d59bff; --pack-ink:#d59bff; }
.legendary { color:#efd175; --pack-ink:#efd175; border-color:#87723e; background:linear-gradient(120deg,#59461f66,#252c37); }
.pity > p { text-align:center; font-size:9px; color:#b7c3d4; margin:10px 0 0; line-height:15px; }
.duplicate-note { margin:0; min-height:28px; display:flex; align-items:center; justify-content:center; gap:7px; color:#b6c3d6; font-size:10px; }
.duplicate-note > span { font-size:18px; }
.sheet { position:absolute; inset:0; display:flex; align-items:flex-end; background:#060a11eb; z-index:40; }
.sheet-in { width:100%; max-height:90%; overflow-y:auto; padding:9px 18px 18px; border-radius:16px 16px 0 0; border:1px solid #5e6a7c; background:linear-gradient(130deg,#303b49,#222b37); box-shadow:0 -10px 40px #0006; }
.sheet-handle { width:38px; height:4px; margin:0 auto 16px; background:#8391a5; border-radius:8px; }
.sheet-in h2 { font-size:20px; letter-spacing:-.02em; margin:5px 0; }
.odds-caption { color:#bac7d9; font-size:11px; margin:0 0 12px; }
.orow { display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:41px; padding:9px 0; border-bottom:1px solid #546175; font-size:13px; }
.ok { display:inline-flex; align-items:center; gap:8px; font-weight:700; }
.ok i { width:7px; height:7px; background:currentColor; border-radius:50%; }
.rarity-C { color:#c9d1dd; } .rarity-R { color:#80bbff; } .rarity-E { color:#d49aff; } .rarity-L { color:#f2d077; }
.fine { color:#c0cddd; font-size:11px; line-height:1.65; margin:13px 0; }
.close-odds { background:#4a596d; box-shadow:inset 0 0 0 1px #7c8ca4; font-size:14px; }
.odds-link:focus-visible,.collection-link:focus-visible,.buy:focus-visible,.close-odds:focus-visible { outline:2px solid var(--cta); outline-offset:2px; border-radius:6px; }
@media(max-width:370px) { .shop-hero { padding-left:12px; padding-right:12px; } .shop-hero h1 { font-size:22px; } .hero-sub p { font-size:11px; } .collection-link { padding:0 3px; font-size:9px; } .shop-body { padding-left:10px; padding-right:10px; } .pack { gap:7px; padding:11px 8px; } .pk-art { flex-basis:42%; width:42%; height:220px; } .pk-name { font-size:16px; } .pk-guar { font-size:10px; padding:4px 5px; } .guarantee-note { font-size:9px; } .buy { font-size:11px; gap:6px; } .buy-price { font-size:15px; } .legendary-rate { font-size:9px; } .short { font-size:8px; } .example { gap:6px; padding:7px; } .example .pack-crest { width:26px; height:31px; } .example h3 { font-size:12px; } .sheet-in { padding-left:14px; padding-right:14px; } .sheet-in h2 { font-size:18px; } }
</style>
