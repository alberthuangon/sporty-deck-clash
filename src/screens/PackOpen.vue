<template>
  <div class="scroll po" :class="[{ 'is-reduced': reduced, 'is-summary': stage === 'summary' && viewing === null }, 'opening-rarity-' + (currentCard?.rarity || 'C')]" :style="{ '--reveal-color': fx.color }">
    <div class="opening-ambient" aria-hidden="true"></div>
    <div v-show="stage === 'reveal' && currentCard?.rarity === 'L'" ref="legendaryRaysEl" class="legendary-rays" aria-hidden="true"><PackParticles :active="stage === 'reveal' && currentCard?.rarity === 'L'" /></div>
    <header v-if="stage !== 'summary'" class="opening-heading"><div><p class="eyebrow">{{ pack.name }} · {{ pulls.length }} players</p><h1>{{ stage === 'sealed' ? 'Your next signing awaits' : stage === 'reveal' ? 'Meet your new lineup' : 'The pack is yours' }}</h1></div><button v-if="stage !== 'summary'" class="skip-results" @click="summary">Reveal all <span aria-hidden="true">↗</span></button></header>
    <div v-if="stage === 'sealed'" class="stage sealed-stage">
      <div class="sealed-orbit" aria-hidden="true"></div>
      <p class="stage-kicker">FIVE PLAYERS. NEW POSSIBILITIES.</p>
      <SealTear ref="sealRef" :title="pack.name" :price="pack.price" :tier="pack.id" hint="Drag the top edge right, or tap to open" @torn="revealFirst" />
      <button class="btn btn-cta" data-sfx="tear" @click="tear">Open your pack <span aria-hidden="true">↗</span></button>
      <p class="sealed-note">Already added to your collection. Enjoy the reveal.</p>
    </div>
    <div v-else-if="stage === 'reveal'" class="stage reveal-stage">
      <div class="reveal-meta"><span class="rarity-label">{{ RARITY[currentCard.rarity].label }} signing</span><span class="counter">{{ index + 1 }} / {{ pulls.length }}</span></div>
      <div class="reveal-progress" aria-hidden="true"><i v-for="n in pulls.length" :key="n" :data-seen="n <= index + 1"></i></div>
      <div class="card-theatre">
        <div class="reveal-aura" ref="auraEl" aria-hidden="true"></div><div ref="raysEl" class="reveal-rays" aria-hidden="true"></div><div ref="flareEl" class="reveal-flare" aria-hidden="true"></div><div ref="ringEl" class="reveal-ring" aria-hidden="true"></div>
        <div class="card-particles" aria-hidden="true"><i v-for="n in 52" :key="n" :style="{ '--n':n }"></i></div>
        <div v-if="index < pulls.length - 1" class="waiting-card waiting-two" aria-hidden="true"></div><div v-if="index < pulls.length - 1" class="waiting-card waiting-one" aria-hidden="true"></div>
        <div class="card-hit" ref="hitEl" @dragstart.prevent role="button" tabindex="0" :aria-label="index === pulls.length - 1 ? 'View pack summary' : 'Reveal next player'" @pointerdown="cardDown" @pointermove="cardMove" @pointerup="cardUp" @pointercancel="cardCancel" @click="cardClick" @keydown.enter.prevent="next" @keydown.space.prevent="next" @keydown.up.prevent="next">
          <div class="card-flipper" ref="flipEl"><div v-show="!faceShown" class="card-back" aria-hidden="true"><PackCrest /><span>SPORTYKICK</span><small>THE NEXT GREAT SIGNING</small></div><HoloCard :aria-hidden="!faceShown" :style="{ visibility: faceShown ? 'visible' : 'hidden' }" class="card-front" :tilt="14" :idle-amplitude="1.8" :idle-duration="5.8"><CardFace ref="cardRef" :card="currentCard" size="lg" :radar="false" full foil class="reveal-card" /></HoloCard></div>
        </div>
      </div>
      <div class="verdict" :style="{ visibility: faceShown ? 'visible' : 'hidden' }" :aria-hidden="!faceShown" aria-live="polite"><div class="result-tag" :class="{ 'new-tag':current.isNew, 'dup-tag':!current.isNew }">{{ current.isNew ? 'NEW SIGNING' : 'DUPLICATE · +1 SHARD' }}</div><p ref="shardLine">{{ current.isNew ? `${currentCard.name} joins your collection` : `${currentCard.name} · ${shardText}` }}</p></div>
      <div class="gesture-hint" aria-hidden="true"><span>↑</span><p>{{ index === pulls.length - 1 ? 'Tap card to see your pack' : 'Tap the card or swipe up' }}</p><small>{{ index === pulls.length - 1 ? 'Your complete lineup awaits' : 'to reveal your next player' }}</small></div>
    </div>
    <div v-else-if="viewing !== null" class="stage detail-stage"><HoloCard class="viewed"><CardFace :card="cardFor(viewed)" size="lg" :radar="false" full foil /></HoloCard><button v-if="canUpgrade(viewed.id)" class="btn btn-cta" @click="goUpgrade(viewed.id)">Upgrade {{ BY_ID[viewed.id].name }}</button><button class="btn" @click="viewing = null">Back to summary</button></div>
    <section v-else ref="summaryEl" class="stage summary-stage" aria-labelledby="summary-title">
      <div class="summary-intro">
        <div class="summary-badge"><span aria-hidden="true">✓</span>Pack complete</div>
        <p class="eyebrow">{{ pack.name }} · {{ pulls.length }} players</p>
        <h1 id="summary-title" class="sum-h" tabindex="-1">Your squad just<br>got stronger</h1>
        <div class="summary-stats">
          <div class="summary-stat new-players"><Icon name="players" :size="21" /><p><strong>{{ newCount }}</strong> new {{ newCount === 1 ? 'player' : 'players' }}</p></div>
          <div class="summary-stat shard-stat"><Icon name="diamond" :size="21" /><p><strong>{{ shardCount }}</strong> upgrade {{ shardCount === 1 ? 'shard' : 'shards' }}</p></div>
        </div>
      </div>
      <div class="sum-grid">
        <button v-for="(p,i) in pulls" :key="i" class="sum-slot" :aria-label="`View ${BY_ID[p.id].name}, ${p.isNew ? 'new player' : 'one shard'}`" @click="viewing = i">
          <CardFace :card="cardFor(p)" size="sm" full :class="{ 'is-new':p.isNew }" :sub="p.isNew ? 'NEW' : '+1 shard'" />
          <i v-if="canUpgrade(p.id)" class="dot"></i>
        </button>
      </div>
      <p class="summary-note">Tap a player to inspect their card</p>
      <div class="summary-actions"><button class="btn btn-cta collection-cta" @click="go('cards')">View collection <span aria-hidden="true">›</span></button><button class="btn shop-return" @click="go('shop')">Back to shop</button></div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import gsap from 'gsap'
import CardFace from '../components/CardFace.vue'
import SealTear from '../components/SealTear.vue'
import HoloCard from '../components/HoloCard.vue'
import PackParticles from '../components/PackParticles.vue'
import PackCrest from '../components/PackCrest.vue'
import Icon from '../components/Icon.vue'
import { flyTo } from '../ui/flyIn.js'
import { artFor } from '../ui/art.js'
import { reduced, uiPlay, UI_TIME } from '../ui/motion.js'
import { store, go, canUpgrade, BY_ID, RARITY } from '../game.js'
import { screenBack } from '../store.js'
import { buildCard } from '../engine/cards.js'
import { PACKS } from '../engine/economy.js'

// Vue adaptation of my-gacha-effect's tear → stack → flip → toss → summary flow.
// Only the presentation reads this record; purchases/grants remain atomic in Shop.
const pack = PACKS.find(p => p.id === (store.pendingPack || 'standard')) || PACKS[0]
const stage = ref('sealed'), index = ref(0), pulls = ref([]), viewing = ref(null)
const summaryEl = ref(null)
const faceShown = ref(false)
const cardRef = ref(null), shardLine = ref(null), sealRef = ref(null)
const hitEl = ref(null), flipEl = ref(null), auraEl = ref(null)
const raysEl = ref(null), flareEl = ref(null), ringEl = ref(null)
const legendaryRaysEl = ref(null)
let revealAnim = null, tossAnim = null, shardAnim = null, alive = true, drag = null, ignoreClick = false
const current = computed(() => pulls.value[index.value] || {})
const currentCard = computed(() => cardFor(current.value))
const viewed = computed(() => viewing.value === null ? null : pulls.value[viewing.value])
const newCount = computed(() => pulls.value.filter(p => p.isNew).length)
const shardCount = computed(() => pulls.value.length - newCount.value)
const shardText = computed(() => current.value.cost ? `${current.value.shards} / ${current.value.cost} shards` : `${current.value.shards} shards`)
const fx = computed(() => ({
  C: { color:'#acbdce', charge:0, shake:0, rays:0, motion:'cardReveal' },
  R: { color:'#80baff', charge:.1, shake:0, rays:0, motion:'cardReveal' },
  E: { color:'#c28bff', charge:.65, shake:5, rays:.65, motion:'cardEpicReveal' },
  L: { color:'#ffd576', charge:1.10, shake:11, rays:1, motion:'cardLegendaryReveal' }
})[currentCard.value?.rarity || 'C'])
function cardFor(p) { return p?.id ? buildCard(BY_ID[p.id], Math.max(1,p.level)) : null }
onMounted(() => {
  const res = store.pendingPulls
  if (!res?.length) { go('shop'); return }
  pulls.value = res
  store.pendingPulls = null
  for (const p of res) { const url = artFor(p.id,'figure'); if (url) { const img = new Image(); img.decoding='async'; img.src=url } }
})
watch(viewing,v => { screenBack.value = v === null ? null : () => { viewing.value = null } },{ immediate:true })
function cancelMotion() { drag=null; if(hitEl.value) gsap.killTweensOf(hitEl.value); revealAnim?.cancel(); tossAnim?.cancel(); shardAnim?.cancel(); revealAnim=null; tossAnim=null; shardAnim=null }
onUnmounted(() => { alive=false; cancelMotion(); screenBack.value=null })
function tear() { sealRef.value?.tear() }
function revealFirst() { if (stage.value !== 'sealed') return; stage.value='reveal'; index.value=0; nextTick(reveal) }
function shardFlight() { if (!alive || stage.value !== 'reveal' || current.value.isNew) return; const card=cardRef.value?.$el; if(card && shardLine.value) shardAnim=flyTo(card,shardLine.value,{glyph:'◈',count:4,colour:'var(--text-2)'}) }
function reveal() {
  if (!alive || stage.value !== 'reveal' || !flipEl.value) return
  hitEl.value.focus({preventScroll:true})
  faceShown.value=false
  const effect=fx.value, charge=effect.charge, d=UI_TIME[effect.motion]
  const flipDuration=d-charge-.18
  gsap.killTweensOf(hitEl.value)
  gsap.set(hitEl.value,{clearProps:'transform,opacity,visibility,filter'})
  gsap.set([flareEl.value,ringEl.value],{opacity:0})
  revealAnim=uiPlay(effect.motion,tl => {
    tl.call(() => { faceShown.value=true },[],charge+flipDuration*.5)
    tl.fromTo(flipEl.value,{rotationY:0},{rotationY:180,duration:flipDuration,ease:'power2.inOut'},charge)
    tl.fromTo(auraEl.value,{opacity:.10,scale:.62},{opacity:effect.rays ? 1 : .75,scale:1.08,duration:effect.shake ? charge : d,ease:'power2.in'},0)
    tl.fromTo([raysEl.value,legendaryRaysEl.value],{opacity:0},{opacity:effect.rays,duration:effect.shake ? charge : d,ease:'power2.in'},0)
    tl.fromTo(hitEl.value,{scale:.94},{scale:effect.shake ? 1.035 : 1,duration:effect.shake ? charge : d,ease:'power2.in'},0)
    if(effect.shake) {
      tl.fromTo(hitEl.value,{filter:'brightness(1)'},{filter:`brightness(${effect.rays===1 ? 1.7 : 1.35})`,duration:charge,ease:'power2.in'},0)
      tl.to(hitEl.value,{filter:'brightness(1)',duration:.18},d-.18)
      // Eight alternating beats return to the center before the card flips.
      tl.fromTo(hitEl.value,{x:-effect.shake/2},{x:effect.shake/2,duration:charge/8,repeat:7,yoyo:true,ease:'sine.inOut'},0)
      tl.set(hitEl.value,{x:0},charge)
      tl.fromTo(flareEl.value,{opacity:0},{opacity:effect.rays*.48,duration:.1,ease:'power2.out'},charge+flipDuration*.45)
      tl.to(flareEl.value,{opacity:0,duration:.25,ease:'power2.out'},charge+flipDuration*.45+.1)
      tl.fromTo(ringEl.value,{opacity:0,scale:.68},{opacity:effect.rays*.85,scale:1,duration:.22,ease:'power2.out'},charge+flipDuration*.45)
      tl.to(ringEl.value,{opacity:0,duration:.25},charge+flipDuration*.45+.22)
      tl.to(hitEl.value,{scale:1,duration:.18,ease:'back.out(1.5)'},d-.18)
      tl.to(auraEl.value,{opacity:effect.rays*.85,duration:.18},d-.18)
    }
  },{interruptible:!!effect.shake,onEnd:() => { if(alive && stage.value==='reveal') shardFlight() }})
}
function next() {
  if(stage.value !== 'reveal') return
  if(revealAnim && !revealAnim.record.done) { revealAnim.skip(); return }
  if(tossAnim && !tossAnim.record.done) return
  shardAnim?.cancel()
  tossAnim=uiPlay('cardToss',tl => {
    tl.to(hitEl.value,{y:-110,x:30,rotation:7,opacity:0,duration:UI_TIME.cardToss,ease:'power2.in'})
  },{onEnd:() => { if(!alive || stage.value!=='reveal') return; if(index.value===pulls.value.length-1) { summary(); return } index.value++; nextTick(reveal) }})
}
function summary() { stage.value='summary'; cancelMotion(); sealRef.value?.reset(); viewing.value=null; nextTick(() => summaryEl.value?.querySelector('h1')?.focus({preventScroll:true})) }
function cardDown(e) { if(e.button>0 || stage.value!=='reveal') return; if(revealAnim && !revealAnim.record.done) { revealAnim.skip(); ignoreClick=true; return } if(tossAnim && !tossAnim.record.done) return; ignoreClick=false; drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false}; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* The pointer may already have ended. */ } }
function cardMove(e) { if(!drag || drag.id!==e.pointerId) return; const dx=e.clientX-drag.x,dy=e.clientY-drag.y; if(Math.hypot(dx,dy)>6) drag.moved=true; if(drag.moved) gsap.set(hitEl.value,{x:Math.max(-45,Math.min(45,dx*.3)),y:Math.max(-100,Math.min(20,dy)),rotation:dx*.025}) }
function cardUp(e) { if(!drag || drag.id!==e.pointerId) return; const d=drag; drag=null; ignoreClick=true; if(!d.moved || e.clientY-d.y < -55) next(); else springBack() }
function cardCancel() { drag=null; ignoreClick=true; springBack() }
function springBack() { if(hitEl.value) gsap.to(hitEl.value,{x:0,y:0,rotation:0,duration:reduced.value?0:.22,ease:'power2.out'}) }
function cardClick() { if(ignoreClick) {ignoreClick=false;return} next() }
function goUpgrade(id) { store.upgradeTarget=id; go('upgrade') }
</script>

<style scoped>
.po { position:relative; isolation:isolate; padding:20px 22px 28px; background:#0c121c; --reveal-color:#b7c8df; }
.opening-ambient { position:absolute; z-index:-1; inset:0; height:100%; pointer-events:none; background:linear-gradient(#0b142377,#0a101ce8 37%,#0b101bee),url('../assets/shop-art/stadium.webp') center top / auto 300px no-repeat; }
.opening-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:66px; }
.eyebrow { color:#adc0d8; font-size:9px; letter-spacing:.13em; text-transform:uppercase; margin:0 0 5px; font-weight:700; }
.opening-heading h1 { font-size:18px; letter-spacing:-.035em; }
.skip-results { flex-shrink:0; padding:0 8px; height:44px; font-size:11px; color:#e0e9f5; border:1px solid #8295b33d; border-radius:24px; background:#152333a6; }
.stage { display:flex; flex-direction:column; align-items:center; gap:14px; position:relative; }
.sealed-stage { padding-top:38px; min-height:660px; justify-content:flex-start; }
.stage-kicker { color:#adc0d8; font-size:9px; letter-spacing:.16em; margin:0 0 32px; }
.sealed-stage :deep(.seal-wrap) { margin:0 0 32px; }
.sealed-stage :deep(.seal) { width:235px; height:325px; filter:drop-shadow(0 18px 24px #0008); }
.sealed-stage :deep(.seal-caption) { margin-top:12px; font-size:14px; }
.sealed-stage :deep(.seal-hint) { margin-top:5px; font-size:11px; }
.sealed-orbit { position:absolute; top:45px; width:310px; height:440px; z-index:-1; background:radial-gradient(ellipse,#8ab5e822,transparent 68%); }
.stage > .btn { width:100%; min-height:46px; max-width:342px; }
.sealed-stage > .btn span { margin-left:8px; }
.sealed-note { font-size:10px; text-align:center; color:#9baec7; margin:0; }
.reveal-stage { gap:0; padding-top:14px; }
.reveal-meta { display:flex; justify-content:space-between; align-items:center; width:100%; max-width:330px; }
.rarity-label { text-transform:uppercase; font-size:10px; letter-spacing:.14em; font-weight:700; color:var(--reveal-color); }
.counter { color:#bfcee0; font-size:12px; font-variant-numeric:tabular-nums; }
.reveal-progress { display:flex; gap:5px; margin-top:12px; width:100%; max-width:330px; }
.reveal-progress i { flex:1; height:3px; background:#ffffff15; border-radius:3px; }
.reveal-progress i[data-seen="true"] { background:var(--reveal-color); box-shadow:0 0 7px color-mix(in srgb,var(--reveal-color) 40%,transparent); }
.card-theatre { position:relative; width:100%; display:grid; place-items:center; padding:38px 0 22px; }
.card-hit { position:relative; z-index:2; width:min(100%,300px); aspect-ratio:5/7; perspective:1200px; cursor:pointer; touch-action:none; user-select:none; }
.card-hit:focus-visible { outline:2px solid var(--reveal-color); outline-offset:8px; border-radius:14px; }
.card-flipper { position:absolute; inset:0; transform-style:preserve-3d; }
.card-front,.card-back { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
.card-front { transform:rotateY(180deg); }
.card-front :deep(.cf) { width:100%; height:100%; }
.card-back { display:flex; flex-direction:column; justify-content:center; align-items:center; gap:14px; border:1px solid #89a7ca; border-radius:12px; background:repeating-linear-gradient(135deg,transparent 0 9px,#adc7ee08 9px 10px),radial-gradient(ellipse at 50% 28%,#34577c,#0b1a2a 70%); box-shadow:inset 0 0 0 7px #122033,inset 0 0 0 8px #6e91bc77,0 20px 40px #0007; --pack-ink:#b4cbe7; }
.card-back .pack-crest { width:82px; height:82px; }
.card-back span { font-size:17px; letter-spacing:.14em; font-weight:800; color:#dce7f4; }
.card-back small { font-size:8px; letter-spacing:.14em; color:#a4bbd7; }
.waiting-card { position:absolute; top:38px; width:min(100%,300px); aspect-ratio:5/7; border-radius:12px; background:linear-gradient(150deg,#294365,#101b2b); box-shadow:inset 0 0 0 1px #768da867; }
.waiting-one { transform:translate(7px,7px) rotate(2deg); }.waiting-two { transform:translate(-7px,13px) rotate(-3deg); }
.reveal-aura { position:absolute; inset:0 20px; border-radius:50%; background:radial-gradient(ellipse,color-mix(in srgb,var(--reveal-color) 30%,transparent),transparent 67%); pointer-events:none; }
.reveal-rays { position:absolute; inset:0; opacity:0; background:repeating-conic-gradient(from 8deg,transparent 0deg 12deg,color-mix(in srgb,var(--reveal-color) 48%,transparent) 13deg 16deg,transparent 17deg 24deg); mask-image:radial-gradient(ellipse,transparent 22%,#000 48%,transparent 73%); pointer-events:none; }
.reveal-flare { position:absolute; inset:0; z-index:3; opacity:0; pointer-events:none; background:radial-gradient(ellipse,#fff9d9 0%,var(--reveal-color) 24%,transparent 67%); }
.reveal-ring { position:absolute; inset:12px 1px; border-radius:50%; opacity:0; pointer-events:none; box-shadow:inset 0 0 16px 3px var(--reveal-color),0 0 20px color-mix(in srgb,var(--reveal-color) 50%,transparent); }
.opening-rarity-E .card-back { border-color:#c28bff; box-shadow:inset 0 0 0 7px #211735,inset 0 0 0 8px #c28bff88,0 0 30px #b67dff55; }
.opening-rarity-L .card-back { border-color:#ffdf85; box-shadow:inset 0 0 0 7px #2b2315,inset 0 0 0 8px #ffd576aa,0 0 48px #ffd57677; }
.opening-rarity-E .reveal-aura { background:radial-gradient(ellipse,color-mix(in srgb,var(--reveal-color) 48%,transparent),transparent 72%); }
/* Legendary rays belong to the whole opening scene. No elliptical mask or
   expanding halo: the beam wedges continue all the way to the screen edges. */
@property --pack-beam-angle { syntax:'<angle>'; inherits:false; initial-value:0deg; }
.legendary-rays { position:absolute; inset:0; z-index:-1; opacity:0; pointer-events:none; overflow:hidden; }
.legendary-rays::before,.legendary-rays::after { content:'';position:absolute;inset:0;pointer-events:none; }
.legendary-rays::before { background:repeating-conic-gradient(from var(--pack-beam-angle) at 50% 43%,transparent 0deg 7deg,#ffdc8447 8deg 10deg,#ffdc8405 12deg 18deg);animation:pack-beam-orbit 38s linear infinite,pack-beam-breathe 4.8s ease-in-out infinite; }
.legendary-rays::after { background:repeating-conic-gradient(from var(--pack-beam-angle) at 50% 43%,transparent 0deg 21deg,#fff1c02e 22deg 25deg,transparent 26deg 38deg);animation:pack-beam-orbit 57s linear infinite reverse,pack-beam-breathe 6.3s ease-in-out -2s infinite reverse; }
@keyframes pack-beam-orbit { from { --pack-beam-angle:0deg; } to { --pack-beam-angle:360deg; } }
@keyframes pack-beam-breathe { 0%,100% { opacity:.45;filter:brightness(.8); } 50% { opacity:1;filter:brightness(1.2); } }
.opening-rarity-L .card-particles { display:none; }
.opening-rarity-L .reveal-aura,.opening-rarity-L .reveal-rays,.opening-rarity-L .reveal-ring { display:none; }
.opening-rarity-L .reveal-flare { background:linear-gradient(135deg,transparent,#fff1bf8a,transparent); }
.opening-rarity-C .card-particles i:nth-child(n+19),.opening-rarity-R .card-particles i:nth-child(n+19),.opening-rarity-E .card-particles i:nth-child(n+33) { display:none; }
.opening-rarity-E .card-particles i { width:3px;height:3px;box-shadow:0 0 10px 1px var(--reveal-color); }
.opening-rarity-L .card-particles i { width:4px;height:4px;background:#fff2b9;box-shadow:0 0 12px 2px var(--reveal-color); }
.card-particles { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.card-particles i { position:absolute; left:calc(4% + mod(var(--n)*31,90)*1%); top:calc(10% + mod(var(--n)*17,80)*1%); width:2px; height:2px; border-radius:50%; background:var(--reveal-color); box-shadow:0 0 7px var(--reveal-color); opacity:.6; animation:motes 3s ease-in-out infinite; animation-delay:calc(var(--n)*-.21s); }
.verdict { text-align:center; min-height:56px; padding-top:8px; width:100%; }
.result-tag { font-size:11px; letter-spacing:.14em; font-weight:800; line-height:18px; }.new-tag { color:var(--cta); }.dup-tag { color:#cad6e5; }
.verdict p { font-size:12px; color:#aebfd4; line-height:18px; margin:5px 0 0; }
.gesture-hint { text-align:center; margin-top:26px; color:#e6edf7; }.gesture-hint > span { display:block; font-size:24px; line-height:30px; color:#b5cbe4; animation:nudge 2s ease-in-out infinite; }.gesture-hint p { margin:5px 0 3px; font-size:12px; }.gesture-hint small { font-size:10px; color:#8298b3; }
.po.is-summary { padding:30px 24px 32px; scrollbar-width:none; }
.po.is-summary::-webkit-scrollbar { display:none; }
.summary-stage { padding-top:0; gap:0; width:100%; }
.summary-intro { width:100%; text-align:center; padding-bottom:22px; margin-bottom:22px; border-bottom:1px solid #adc3e21f; }
.summary-badge { display:inline-flex; align-items:center; justify-content:center; gap:10px; min-height:32px; padding:5px 12px; margin-bottom:14px; color:#54ed89; border:1px solid #54ed8980; border-radius:22px; background:#071b16a6; box-shadow:0 0 20px #36cf6c0c; text-transform:uppercase; font-size:11px; font-weight:800; letter-spacing:.11em; }
.summary-badge span { display:grid; place-items:center; width:19px; height:19px; border-radius:50%; background:#37e779; color:#07391a; font-size:14px; letter-spacing:0; }
.summary-intro .eyebrow { margin:0 0 12px; font-size:10px; letter-spacing:.12em; }
.sum-h { outline:none; font-size:31px; line-height:1.14; letter-spacing:-.04em; font-weight:800; }
.summary-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:22px; }
.summary-stat { display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 6px; min-height:40px; border:1px solid #a7bdd138; border-radius:9px; background:#0b1521c9; color:#bdcce0; }
.summary-stat p { margin:0; color:#e3eaf4; font-size:12px; white-space:nowrap; }
.summary-stat strong { font-size:19px; line-height:1; font-weight:800; margin-right:3px; }
.new-players,.new-players strong { color:#35e978; }
.shard-stat :deep(.icon) { fill:#bbcbdf; stroke:#dae5f3; }
.sum-grid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; width:100%; }
.sum-slot { position:relative; cursor:pointer; display:flex; text-align:initial; min-width:0; grid-column:span 2; border-radius:9px; }
.sum-slot:nth-child(4) { grid-column:2 / span 2; }
.sum-slot:nth-child(5) { grid-column:4 / span 2; }
.sum-slot > .cf { flex:1; min-width:0; }
.sum-slot:focus-visible { outline:2px solid #b8cdeb; outline-offset:4px; }
.sum-slot :deep(.is-new .cf-role) { color:var(--cta); font-weight:800; }
.summary-note { font-size:11px; color:#a7b9d1; line-height:1.4; margin:20px 0 22px; text-align:center; }
.summary-actions { display:flex; flex-direction:column; gap:12px; width:100%; }
.collection-cta { height:52px; min-height:52px; border-radius:10px; font-size:17px; gap:12px; }
.collection-cta span { font-size:30px; line-height:1; font-weight:400; margin-top:-3px; }
.shop-return { height:48px; min-height:48px; border:1px solid #7d91ad; border-radius:10px; color:#f0f4fa; background:#0c172366; font-size:16px; }
.viewed { width:min(100%,280px); }.viewed :deep(.cf) { width:100%; }.detail-stage { padding-top:20px; }
@media(max-width:370px) { .po.is-summary { padding:24px 16px 20px; }.sum-h { font-size:27px; }.summary-stats { gap:8px; margin-top:18px; }.summary-stat { gap:4px; padding:9px 4px; }.summary-stat p { font-size:10px; }.summary-stat strong { font-size:17px; margin-right:1px; }.summary-stat :deep(.icon) { width:17px !important; height:17px !important; }.summary-intro { padding-bottom:18px; margin-bottom:18px; }.sum-grid { gap:10px; }.summary-note { margin:18px 0; font-size:10px; }.collection-cta { height:48px;min-height:48px;font-size:16px; }.shop-return { height:44px;min-height:44px;font-size:15px; } }
@keyframes motes { 50% { opacity:.15; } }@keyframes rays { to { transform:rotate(360deg); } }@keyframes nudge { 50% { opacity:.5; } }
.is-reduced .legendary-rays::before,.is-reduced .legendary-rays::after,.is-reduced .card-particles i,.is-reduced .reveal-rays,.is-reduced .gesture-hint > span { animation:none; }
@media(max-width:370px),(max-height:780px) { .po { padding:12px 18px 22px; }.opening-heading h1 { font-size:16px; }.opening-heading { min-height:57px; }.card-hit,.waiting-card { width:min(100%,245px); }.card-theatre { padding-top:25px;padding-bottom:16px; }.waiting-card { top:25px; }.gesture-hint { margin-top:13px; }.sealed-stage { padding-top:18px;min-height:580px; }.sealed-stage :deep(.seal) { width:210px;height:290px; }.stage-kicker { margin-bottom:18px; }.sealed-stage :deep(.seal-wrap) { margin-bottom:14px; } }
</style>
