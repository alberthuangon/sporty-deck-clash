<template>
  <div class="scroll missions-page">
    <section class="missions-hero" aria-labelledby="missions-title">
      <p class="hero-eyebrow">Daily objectives</p>
      <h1 id="missions-title">Earn diamonds.<br>Build your squad.</h1>
      <p class="hero-caption">Complete daily missions for card packs.</p>
      <div class="hero-overview" aria-label="Mission status">
        <div class="summary-count ready-count"><div class="count-value"><i aria-hidden="true"></i><strong>{{ counts.ready }}</strong></div><span>Ready</span></div>
        <div class="summary-count ongoing-count"><div class="count-value"><i aria-hidden="true"></i><strong>{{ counts.ongoing }}</strong></div><span>In progress</span></div>
        <div class="summary-count claimed-count"><div class="count-value"><i aria-hidden="true">✓</i><strong>{{ counts.claimed }}</strong></div><span>Claimed</span></div>
      </div>
    </section>
    <div class="missions-heading"><h2>Today's missions</h2><span><Icon name="history" :size="14" />Resets in 6h 12m</span></div>
    <div class="mission-list">
      <article v-for="t in orderedTasks" :key="t.id" class="mission" :class="[status(t), { featured: featured.has(t.id) }]" :data-task="t.id" :aria-labelledby="`mission-${t.id}`">
        <div class="m-top"><span class="period-label">{{ t.period }}</span><span class="mission-state"><i class="state-mark" aria-hidden="true">{{ t.claimed ? '✓' : '' }}</i>{{ t.claimed ? 'Claimed' : t.done ? 'Ready to claim' : 'In progress' }}</span></div>
        <h3 class="m-title" :id="`mission-${t.id}`">{{ t.title }}</h3>
        <p v-if="featured.has(t.id)" class="completion-note"><span aria-hidden="true">✓</span>Requirement completed</p>
        <div v-if="!t.done && !t.claimed" class="mission-progress">
          <template v-if="progress(t)"><p>{{ progress(t).value }} / {{ progress(t).total }}{{ t.id === 't3' ? ' rounds' : '' }}</p><div class="progress-track" role="progressbar" :aria-label="`${t.title} progress`" :aria-valuenow="progress(t).value" :aria-valuemin="0" :aria-valuemax="progress(t).total"><i :style="{ width: progress(t).percent + '%' }"></i></div></template>
          <p v-else>In progress</p>
        </div>
        <div class="mission-footer" :class="{ 'featured-footer': featured.has(t.id) }">
          <div class="rw"><DiamondIcon :size="34" /><div class="reward-copy"><strong>{{ t.reward }}</strong><span>Diamonds</span></div></div>
          <button v-if="featured.has(t.id)" class="btn btn-cta claim" :class="{ done: t.claimed }" data-sfx="claim" :disabled="t.claimed" :aria-label="t.claimed ? `${t.title}, reward claimed` : `Claim ${t.reward} diamonds for ${t.title}`" @click="claim(t, $event)"><span>{{ t.claimed ? 'Claimed' : 'Claim reward' }}</span></button>
        </div>
      </article>
      <p v-if="!orderedTasks.length" class="empty-missions">No missions available right now.</p>
    </div>
    <div class="mission-tip"><DiamondIcon :size="23" /><p>Use your diamonds to open player packs.</p></div>
    <Teleport to=".phone"><div v-if="justClaimed" class="toast mission-toast" role="status">+{{ justClaimed }} diamonds added to your balance</div></Teleport>
  </div>
</template>

<script setup>
import DiamondIcon from '../components/DiamondIcon.vue'
import { ref, computed, onUnmounted } from 'vue'
import { store, claimTask } from '../game.js'
import { flyTo } from '../ui/flyIn.js'
import Icon from '../components/Icon.vue'
const justClaimed = ref(0)
const priority = t => t.claimed ? 2 : t.done ? 0 : 1
// Rank when entering the page. A claim updates status/counts immediately, but
// retains its card's space and position while the reward travels to the wallet.
const order = new Map([...store.tasks].sort((a,b)=>priority(a)-priority(b)).map((t,i)=>[t.id,i]))
const featured = new Set(store.tasks.filter(t=>t.done && !t.claimed).map(t=>t.id))
const orderedTasks = computed(()=>[...store.tasks].sort((a,b)=>(order.get(a.id) ?? Infinity)-(order.get(b.id) ?? Infinity)))
const counts = computed(()=>({ready:store.tasks.filter(t=>t.done&&!t.claimed).length,ongoing:store.tasks.filter(t=>!t.done&&!t.claimed).length,claimed:store.tasks.filter(t=>t.claimed).length}))
const status = t => t.claimed ? 'claimed' : t.done ? 'ready' : 'ongoing'
function progress(t) {
  const match=String(t.progress || '').match(/^(\d+)\s*\/\s*(\d+)$/)
  if(!match || !Number(match[2])) return null
  const total=Number(match[2]),value=Math.min(total,Number(match[1]))
  return {value,total,percent:value/total*100}
}
let toastTimer=0
const flights=new Set()
function claim(t,ev) {
  const n=claimTask(t.id)
  if(!n) return
  justClaimed.value=n
  const flight=flyTo(ev.currentTarget,'diamonds')
  if(flight) flights.add(flight)
  clearTimeout(toastTimer)
  toastTimer=setTimeout(()=>{justClaimed.value=0},2200)
}
onUnmounted(()=>{clearTimeout(toastTimer);flights.forEach(f=>f.cancel())})
</script>

<style scoped>
.missions-page { padding:12px; background:#141b24; scrollbar-width:none; }
.missions-page::-webkit-scrollbar { display:none; }
.missions-hero { padding:14px 14px 10px; border:1px solid #258a6d; border-radius:12px; background:linear-gradient(90deg,#00150d38,transparent),url('../assets/missions-art/hero.webp') center / cover; box-shadow:0 8px 30px #0002; }
.hero-eyebrow { margin:0; color:#5de99b; font-size:9px; font-weight:800; letter-spacing:.22em; text-transform:uppercase; }
.missions-hero h1 { margin:8px 0 8px; max-width:260px; font-size:25px; line-height:1.1; letter-spacing:-.035em; font-weight:800; text-shadow:0 2px 12px #00140f; }
.hero-caption { margin:0; font-size:12px; line-height:1.4; color:#c3d2dd; text-shadow:0 1px 8px #000; }
.hero-overview { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin-top:12px; padding:6px 0; border:1px solid #4276638c; border-radius:9px; background:#031812bc; }
.summary-count { display:flex; flex-direction:column; align-items:center; gap:3px; color:#cedcd9; font-size:10px; line-height:1.2; }
.summary-count + .summary-count { border-left:1px solid #8ac3ab40; }
.count-value { display:flex; align-items:center; justify-content:center; gap:11px; height:24px; }
.count-value strong { color:#f4faf7; font-size:21px; line-height:1; font-weight:800; font-variant-numeric:tabular-nums; }
.count-value i { display:block; width:8px; height:8px; border-radius:50%; background:#35e58c; }
.ongoing-count i { background:#34c9ef; }.claimed-count i { width:14px; height:14px; background:transparent; color:#66eda0; font-size:16px; font-weight:800; font-style:normal; line-height:14px; }
.missions-heading { display:flex; justify-content:space-between; align-items:center; gap:8px; margin:14px 2px 12px; }
.missions-heading h2 { font-size:17px; line-height:1.25; letter-spacing:-.025em; }
.missions-heading > span { display:flex; align-items:center; gap:6px; flex-shrink:0; font-size:10px; color:#aebbcf; }
.mission-list { display:flex; flex-direction:column; gap:12px; }
.mission { padding:13px 15px; border:1px solid #3c495a; border-radius:12px; background:linear-gradient(#18222c30,#18222c30),url('../assets/missions-art/panel.webp') right bottom / cover; box-shadow:0 6px 20px #0001; }
.mission.ready { border-color:#34e68b; background:linear-gradient(100deg,#002b22df,#00271db3),url('../assets/missions-art/panel.webp') right bottom / cover; box-shadow:0 0 18px #25d77c0d; }
.mission.claimed { background:linear-gradient(#1b242c22,#1b242c44),url('../assets/missions-art/panel.webp') right bottom / cover; }
.mission.claimed:not(.featured) { padding-top:12px; padding-bottom:12px; }
.mission.claimed:not(.featured) .mission-footer { margin-top:8px; }
.m-top { display:flex; justify-content:space-between; align-items:center; gap:10px; min-height:19px; margin-bottom:10px; }
.period-label { display:inline-flex; align-items:center; border-radius:5px; padding:3px 8px; background:#7894a52b; color:#c8d7df; font-size:10px; line-height:1.2; }
.mission-state { display:flex; align-items:center; gap:7px; color:#48d4f3; font-size:11px; line-height:16px; font-weight:600; }
.state-mark { display:grid; place-items:center; width:12px; height:12px; font-style:normal; line-height:12px; font-size:15px; }
.ready .state-mark::before,.ongoing .state-mark::before { content:''; width:8px; height:8px; border-radius:50%; background:currentColor; }
.ready .mission-state { color:#4dea93; }.claimed .mission-state { color:#99e9aa; }
.m-title { font-size:16px; line-height:1.28; font-weight:750; letter-spacing:-.025em; margin:0; }
.completion-note { display:flex; align-items:center; gap:9px; margin:11px 0 0; color:#a7c1bc; font-size:11px; line-height:18px; }
.completion-note > span { display:grid; place-items:center; width:17px; height:17px; border-radius:50%; background:#45e790; color:#073520; font-weight:800; }
.mission-progress { margin-top:11px; }
.mission-progress p { margin:0 0 6px; color:#b0bfd4; font-size:11px; line-height:15px; }
.progress-track { height:8px; border-radius:8px; overflow:hidden; background:#3a4859; }
.progress-track i { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#26bfe5,#73e5ff); }
.mission-footer { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:13px; }
.featured-footer { border-top:1px solid #7fbaa340; padding-top:10px; }
.rw { display:flex; align-items:center; gap:9px; min-height:43px; }
.rw img { width:34px; height:34px; object-fit:contain; filter:drop-shadow(0 0 8px #18d4f445); }
.reward-copy { display:flex; flex-direction:column; gap:2px; }
.reward-copy strong { font-size:25px; font-weight:800; line-height:1; }
.reward-copy span { font-size:10px; line-height:1.3; color:#b7c6d8; }
.claim { flex:0 0 47%; width:47%; min-height:44px; height:44px; padding:0 6px; font-size:14px; border-radius:7px; background:linear-gradient(100deg,#3ae980,#6bec91); }
.claim.done { background:#12362b99; box-shadow:inset 0 0 0 1px #63aa8880; color:#a1ddbc; }
.mission-tip { display:flex; align-items:center; gap:13px; padding:13px 15px; margin-top:15px; border:1px solid #3c615a; border-radius:10px; background:linear-gradient(100deg,#0b2524,#0d2322); color:#41cce9; }
.mission-tip p { padding-left:13px; border-left:1px solid #77958b73; margin:0; color:#c7d6e0; font-size:12px; line-height:1.4; }
.empty-missions { padding:26px 12px; text-align:center; font-size:13px; color:#b6c5d6; }
.mission-toast { position:absolute; left:50%; transform:translateX(-50%); bottom:calc(var(--tabbar-h) + 16px); width:max-content; max-width:calc(100% - 28px); padding:10px 15px; margin:0; border-radius:24px; background:#b6ffd0; color:#073d22; text-align:center; font-size:12px; line-height:1.4; font-weight:700; box-shadow:0 8px 24px #0005; z-index:50; pointer-events:none; }
@media(max-width:370px) { .missions-page { padding:10px; }.missions-hero { padding:14px 11px 9px; }.missions-hero h1 { font-size:23px;max-width:230px; }.hero-caption { font-size:10px; }.hero-eyebrow { font-size:8px; }.missions-heading h2 { font-size:16px; }.missions-heading > span { font-size:9px;gap:4px; }.mission { padding:12px; }.m-title { font-size:14px; }.mission-state { font-size:10px;gap:5px; }.claim { font-size:12px; }.mission-tip { gap:10px;padding:12px; }.mission-tip p { padding-left:10px;font-size:11px; } }
</style>
