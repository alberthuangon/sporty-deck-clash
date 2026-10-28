<template>
  <div class="scroll hm">
    <section class="squad" aria-label="Your squad">
      <div class="sq-head"><h2 class="play-title">Your squad</h2><button class="sq-edit" @click="go('deckedit')">Edit squad <span aria-hidden="true">›</span></button></div>
      <div class="lineup">
        <div v-for="s in SLOTS" :key="s.key" class="lu">
          <div class="lu-lbl">{{ s.short }}</div>
          <CardFace :card="cardOf(store.deck[s.key])" size="sm" full />
        </div>
      </div>
      <button class="squad-rank" @click="go('rank')"><RankCrest :tier="store.rank.tierIndex" :sub="store.rank.subtier" /><span>Your rank: <strong>{{ myRank }}</strong></span><span class="rank-arrow" aria-hidden="true">›</span></button>
    </section>
    <div class="play-body">
      <section class="arenas" aria-labelledby="arena-heading">
        <h2 class="play-title" id="arena-heading">Choose your arena</h2>
        <p class="arena-intro">Select an arena to start your match.</p>
        <div class="arena-row" role="group" aria-label="Choose an arena">
          <button v-for="(t, i) in TIERS" :key="t.id" class="arena" :class="['tier-' + i, { locked: !unlocked(t), sel: chosen === t.fee }]" :disabled="!unlocked(t)" :aria-pressed="chosen === t.fee" :aria-label="`${t.name}, stakes ₦${range(t).min} to ₦${range(t).max}${unlocked(t) ? '' : ', requires ' + ladderLabel(t.unlockRank)}`" @click="choose(t)">
            <span class="arena-scene"><img :src="arenaArt[i]" width="600" height="400" alt="" decoding="async"><span v-if="!unlocked(t)" class="arena-lock" aria-hidden="true"><Icon name="lock" :size="17" /></span><span v-if="chosen === t.fee" class="arena-check" aria-hidden="true">✓</span></span>
            <span class="a-info"><strong class="a-fee">₦{{ t.fee }}</strong><span class="a-name">{{ t.name }}</span><span class="a-need">{{ !unlocked(t) ? ladderLabel(t.unlockRank) + ' required' : chosen === t.fee ? 'Selected' : 'Available' }}</span><span class="a-stake">₦{{ range(t).min }}–₦{{ range(t).max }}</span></span>
          </button>
        </div>
      </section>
      <button class="btn btn-cta big" :disabled="!chosen" data-sfx="start" @click="start"><Icon v-if="chosen" name="play" :size="22" /><span>{{ chosen ? `START MATCH · ₦${chosen}` : 'Choose an arena to start' }}</span><span v-if="chosen" class="start-arrow" aria-hidden="true">›</span></button>
      <section class="recent card" v-if="store.history.length" aria-label="Recent matches">
        <div class="rc-head"><h2 class="play-title">Recent matches</h2><button class="rc-all" @click="go('history')">All ›</button></div>
        <button v-for="m in store.history.slice(0, 3)" :key="m.id" class="rc-row" @click="go('history')"><i class="rc-dot" :class="m.won ? 'w' : 'l'"></i><span class="rc-sc">{{ m.homeScore }}:{{ m.awayScore }}</span><span class="rc-opp">{{ m.opponent.handle }}</span><span class="rc-net" :class="m.net >= 0 ? 'up' : 'down'">{{ m.net >= 0 ? '+' : '' }}₦{{ Math.abs(m.net).toLocaleString() }}</span></button>
      </section>
      <JackpotPanel @last-season="showLastSeason" />
      <p class="ticket-road">Earn draw tickets on the Rank reward road.</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Icon from '../components/Icon.vue'
import RankCrest from '../components/RankCrest.vue'
import practiceArt from '../assets/play-art/practice.webp'
import homeArt from '../assets/play-art/home.webp'
import proArt from '../assets/rank-art/stadium.webp'
import CardFace from '../components/CardFace.vue'
import JackpotPanel from '../components/JackpotPanel.vue'
import { store, go, cardOf, TIERS, stakeRange, tierUnlocked, ladderLabel, rankLabel, openLastSeasonDraw } from '../game.js'

const SLOTS = [
  { key: 'gk', short: 'GK' }, { key: 'df', short: 'DF' },
  { key: 'mf', short: 'MF' }, { key: 'fw', short: 'FW' }
]
/* The arenas are gated on RANK now (see the note on TIERS in economy.js).
   The Squad Power stars that used to sit in the top-left were deckPower()
   and never had anything to do with the gate — the old gate was
   collectionPower() — so removing them loses a number, it does not move one.
   What moves into the lock line is the player's rank, which IS the thing
   being compared, written with the same ladderLabel the requirement uses. */
const myRank = computed(() => rankLabel(store.rank.tierIndex, store.rank.subtier))
const chosen = computed(() => TIERS.find(t => t.fee === store.pendingTier && tierUnlocked(t))?.fee || null)
const arenaArt = [practiceArt, homeArt, proArt]

/* Demo: the season draw happens at season end, which nobody reaches in a
   pitch. This is the way in — sealed until opened, then a record of what
   happened. */
function showLastSeason () { openLastSeasonDraw() }
function unlocked (t) { return tierUnlocked(t) }
function range (t) { return stakeRange(t.fee) }
function choose (t) { if (unlocked(t)) store.pendingTier = t.fee }
/* straight to matchmaking: the arena that screen was for is chosen here now */
function start () { if (chosen.value) go('matchmaking') }
</script>
<style scoped>
.hm { display: flex; flex-direction: column; background: #191e25; scrollbar-width: thin; scrollbar-color: #505966 transparent; }
.hm > * { flex-shrink: 0; }
.squad { padding: 10px 16px 10px; background: linear-gradient(180deg,#141c2655,#191e2533 60%,#191e25),url('../assets/rank-art/stadium.webp') center 55% / cover; }
.sq-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; min-height:38px; }
.play-title { display:flex; align-items:center; gap:8px; font-size:16px; text-transform:uppercase; letter-spacing:.015em; }
.play-title::before { content:''; display:block; width:3px; height:15px; border-radius:3px; background:var(--green); flex:none; }
.sq-edit { min-height:44px; font-size:12px; font-weight:700; color:#69eb92; padding:0 0 0 10px; }
.sq-edit span { font-size:20px; vertical-align:-1px; margin-left:3px; }
.lineup { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; }
.lu { display:flex; flex-direction:column; gap:6px; min-width:0; }
.lu-lbl { text-align:center; font-size:10px; font-weight:700; color:#c1c8d2; letter-spacing:.05em; }
.squad-rank { margin-top:8px; width:100%; min-height:48px; padding:3px 10px; display:flex; align-items:center; gap:9px; border-radius:8px; background:linear-gradient(120deg,#303641e8,#252c35e8); box-shadow:inset 0 0 0 1px #ffffff13; font-size:12px; color:#c0c8d2; text-align:left; }
.squad-rank strong { color:#e4b781; }
.rank-arrow { margin-left:auto; color:#c0a17c; font-size:23px; }
.play-body { padding:0 16px 10px; display:flex; flex-direction:column; gap:12px; }
.arena-intro { color:#bbc3ce; font-size:12px; margin:5px 0 12px; }
.arena-row { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.arena { position:relative; overflow:hidden; border-radius:9px; border:1px solid #657080; background:linear-gradient(145deg,#2c323c,#20262f); display:flex; flex-direction:column; width:100%; text-align:center; min-width:0; }
.arena-scene { display:block; width:100%; aspect-ratio:1.7; position:relative; overflow:hidden; }
.arena-scene img { width:100%; height:100%; object-fit:cover; display:block; }
.arena-scene::after { content:''; position:absolute; inset:0; background:linear-gradient(180deg,transparent 55%,#20262f88); pointer-events:none; }
.arena.locked .arena-scene img { filter:saturate(.55) brightness(.72); }
.arena-lock { position:absolute; bottom:4px; left:50%; transform:translateX(-50%); width:29px; height:29px; display:flex; align-items:center; justify-content:center; border:1px solid #a9b2c1; border-radius:50%; background:#1e2632ed; z-index:1; color:#e8eef6; }
.arena-check { position:absolute; top:7px; right:7px; width:23px; height:23px; border-radius:50%; background:#45e981; color:#062912; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800; z-index:1; }
.a-info { display:flex; flex-direction:column; align-items:center; gap:5px; padding:10px 3px 12px; width:100%; }
.a-fee { font-size:23px; line-height:1.15; font-variant-numeric:tabular-nums; }
.a-name { font-size:11px; font-weight:700; line-height:1.3; white-space:nowrap; }
.a-need { font-size:9px; line-height:14px; min-height:14px; color:#b9c2cf; white-space:nowrap; }
.a-stake { font-size:10px; font-variant-numeric:tabular-nums; color:#bfc7d2; }
.arena.sel { border-color:#49e77d; box-shadow:inset 0 0 0 1px #49e77d,0 0 12px #32ce621a; }
.arena.sel .a-need { color:#6aee96; font-weight:700; }
.arena:focus-visible,.squad-rank:focus-visible,.ticket-road:focus-visible { outline:2px solid var(--cta); outline-offset:3px; }
.big { position:relative; display:flex; gap:10px; min-height:50px; height:50px; font-size:16px; letter-spacing:.015em; background:linear-gradient(110deg,#49e77d,#2fd668); color:#062811; box-shadow:0 4px 18px #1fbb4e13; }
.big:disabled { color:#c0c6d0; background:#2a3039; box-shadow:inset 0 0 0 1px #4c5460; font-size:14px; }
.start-arrow { position:absolute; right:15px; font-size:28px; line-height:1; }
.recent { padding:12px; background:#252c35; }
.rc-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.rc-head .play-title { font-size:13px; }
.rc-all { min-width:44px; min-height:44px; padding:0 8px; font-size:12px; color:#69eb92; font-weight:700; }
.rc-row { display:flex; align-items:center; gap:8px; width:100%; min-height:44px; font-size:12px; text-align:left; }
.rc-dot { width:7px; height:7px; border-radius:50%; flex:none; }
.rc-dot.w { background:var(--cta); } .rc-dot.l { background:var(--loss); }
.rc-sc { font-weight:700; font-variant-numeric:tabular-nums; width:30px; }
.rc-opp { flex:1; color:#b9c2ce; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rc-net { font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
.rc-net.up { color:var(--green); } .rc-net.down { color:var(--loss); }
.ticket-road { margin:0; line-height:15px; color:#b6bfcc; font-size:10px; text-align:center; }
.ticket-road span { margin-left:4px; }
@media(max-width:370px) { .squad { padding-left:12px; padding-right:12px; } .play-body { padding-left:12px; padding-right:12px; } .arena-row { gap:6px; } .a-name { font-size:9px; } .a-need { font-size:8px; } .a-stake { font-size:9px; } .a-fee { font-size:20px; } .play-title { font-size:14px; } .sq-edit { font-size:11px; } .big { font-size:14px; } }
</style>
