<template>
  <div class="hi">
    <div v-if="!detail" ref="listEl" class="history-list scroll">
      <header class="history-hero">
        <p class="eyebrow">YOUR MATCH ARCHIVE</p>
        <h1>Your match record.</h1>
        <p class="hero-caption">Results, rewards and every replay.</p>
      </header>
      <div class="archive-body">
        <div class="history-filters" role="group" aria-label="Filter match history">
          <button v-for="f in filters" :key="f.id" :aria-pressed="filter === f.id" :data-filter="f.id" @click="filter = f.id">{{ f.label }}<span>{{ f.count }}</span></button>
        </div>
        <div class="list-heading"><h2>{{ filter === 'all' ? 'Recent matches' : filter === 'wins' ? 'Your wins' : 'Your losses' }}</h2><span>{{ filtered.length }} {{ filtered.length === 1 ? 'match' : 'matches' }}</span></div>
        <div v-if="!filtered.length" class="history-empty" role="status">
          <Icon name="history" :size="38" />
          <h2>{{ store.history.length ? 'No matches in this view' : 'Your story starts here' }}</h2>
          <p>{{ store.history.length ? 'Choose another filter to see your saved matches.' : 'Completed matches will appear here with your results, squad and replay.' }}</p>
        </div>
        <button v-for="m in filtered" :key="m.id" class="row" :class="m.won ? 'won' : 'lost'" :data-match-id="m.id" :aria-label="recordLabel(m)" @click="openDetail(m)">
          <div class="record-top"><span class="result-tag"><span aria-hidden="true">{{ m.won ? '✓' : '−' }}</span>{{ m.won ? 'WON' : 'LOST' }}</span><time :datetime="new Date(m.at).toISOString()" :title="dateLabel(m.at)">{{ ago(m.at) }}</time><span class="record-arrow" aria-hidden="true">›</span></div>
          <div class="record-main">
            <div class="record-opponent"><span class="opponent-name">vs {{ m.opponent.handle }}</span><span class="record-arena">{{ arenaName(m.tierFee) }} · {{ m.aIsHome ? 'Home' : 'Away' }}</span></div>
            <div class="record-score"><b>{{ yourScore(m) }} : {{ rivalScore(m) }}</b><span>{{ m.wentToPk ? 'PENALTIES' : 'FULL TIME' }}</span></div>
          </div>
          <div class="record-bottom"><span class="record-net" :class="m.net < 0 ? 'down' : 'up'">{{ signedCash(m.net) }}<small>net</small></span><span v-if="m.wentToPk" class="ninety-score">90′ {{ m.aIsHome ? m.homeScore : m.awayScore }} : {{ m.aIsHome ? m.awayScore : m.homeScore }}</span><span class="record-rank" :class="m.rankDelta < 0 ? 'down' : 'up'">{{ signed(m.rankDelta) }} rank</span></div>
        </button>
        <p v-if="filtered.length" class="archive-footnote">Your saved results. Every match can be replayed.</p>
      </div>
    </div>

    <div v-else class="history-detail">
      <div class="detail-scroll scroll">
        <header class="detail-hero" :class="{ won: detail.won }">
          <h1 ref="detailHeading" tabindex="-1">{{ detail.won ? 'VICTORY' : 'DEFEAT' }}</h1>
          <span class="rank-change" :class="detail.rankDelta < 0 ? 'down' : 'up'">{{ signed(detail.rankDelta) }} rank</span>
        </header>
        <section class="detail-score panel" aria-label="Final score">
          <div class="score-grid">
            <div class="score-team home"><DuelCrest :label="detail.aIsHome ? 'SK' : initials(detail.opponent.handle)" /><span><i aria-hidden="true"></i>{{ detail.aIsHome ? 'You' : detail.opponent.handle }}</span></div>
            <div class="score-tally"><h2>{{ detail.wentToPk ? 'PENALTY SHOOTOUT' : 'FULL TIME' }}</h2><div class="sc">{{ detail.wentToPk ? detail.pk.home : detail.homeScore }}<span>:</span>{{ detail.wentToPk ? detail.pk.away : detail.awayScore }}</div><div v-if="detail.wentToPk" class="regular-score">{{ detail.homeScore }} : {{ detail.awayScore }}<span>after 90′</span></div></div>
            <div class="score-team away"><DuelCrest :label="detail.aIsHome ? initials(detail.opponent.handle) : 'SK'" /><span><i aria-hidden="true"></i>{{ detail.aIsHome ? detail.opponent.handle : 'You' }}</span></div>
          </div>
          <details class="goals-panel"><summary><Icon name="play" :size="16" /><span>Match goals</span><small>{{ detailGoals.length }} {{ detailGoals.length === 1 ? 'goal' : 'goals' }} · 90′</small><i aria-hidden="true">⌄</i></summary><div v-if="detailGoals.length" class="goals"><div v-for="(g,i) in detailGoals" :key="i" class="goal-row" :class="g.side.toLowerCase()"><span class="goal-minute">{{ g.minute }}′</span><div><b>{{ g.actorName }}</b><span class="goal-team"><i aria-hidden="true"></i>{{ teamOf(g.side) }}</span></div><span class="goal-word">GOAL</span></div></div><p v-else class="no-goals">No goals in regular time.</p></details>
        </section>
        <section class="saved-squad" aria-labelledby="squad-title"><div class="section-heading"><h2 id="squad-title">My squad</h2><span>At kick-off</span></div><div class="deck"><div v-for="s in SLOTS" :key="s" class="squad-slot"><CardFace :card="snapCard(detail.decks.you[s])" size="sm" full /></div></div></section>
        <section class="settlement" aria-labelledby="settlement-title">
          <h2 id="settlement-title">BET SUMMARY</h2>
          <dl class="bet-summary"><div class="net-row"><dt>{{ detail.net >= 0 ? 'Net profit' : 'Net loss' }}</dt><dd :class="detail.net < 0 ? 'down' : 'up'">{{ signedCash(detail.net) }}</dd></div><div><dt>Stake</dt><dd>₦{{ money(detail.stake) }}</dd></div><div><dt>Total payout <small>including stake</small></dt><dd>₦{{ money(detail.payout) }}</dd></div><div><dt>Settled odds <small>{{ detail.aIsHome ? 'HOME' : 'AWAY' }}</small></dt><dd>{{ detail.odds.toFixed(2) }}</dd></div><div><dt>Arena</dt><dd>{{ arenaName(detail.tierFee) }} · ₦{{ money(detail.tierFee) }}</dd></div></dl>
          <details class="bet-details"><summary><span>{{ detail.promotions.length ? 'Bet details & rewards' : 'Bet details' }}</span><small>Quoted prices</small><i aria-hidden="true">⌄</i></summary><dl><div class="quoted"><dt>Quoted odds</dt><dd>Home {{ detail.oddsIfHome.toFixed(2) }} · Away {{ detail.oddsIfAway.toFixed(2) }}</dd></div></dl><p v-if="detail.won" class="calculation">₦{{ money(detail.stake) }} × {{ detail.odds.toFixed(2) }} = {{ (detail.stake * detail.odds).toFixed(2) }}<br>Payout rounded down to ₦{{ money(detail.payout) }}.</p><p v-else class="calculation">Stake ₦{{ money(detail.stake) }} · Payout ₦{{ money(detail.payout) }}</p><div v-for="p in detail.promotions" :key="p.id" class="promo"><Icon name="rank" :size="20" /><div><small>RANK REWARD</small><b>{{ p.label }}</b></div><span v-if="p.reward.diamonds"><DiamondIcon :size="18" />{{ p.reward.diamonds }}</span><span v-if="p.reward.tickets"><Icon name="ticket" :size="20" />{{ p.reward.tickets }}</span></div></details>
        </section>
      </div>
      <footer class="history-actions"><button class="btn btn-cta" @click="replay"><span aria-hidden="true">▶</span> Replay this match</button><p>Saved replay · Results and balance stay unchanged</p></footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import DiamondIcon from '../components/DiamondIcon.vue'
import Icon from '../components/Icon.vue'
import CardFace from '../components/CardFace.vue'
import DuelCrest from '../components/DuelCrest.vue'
import { store, BY_ID, startReplay } from '../game.js'
import { screenBack } from '../store.js'
import { buildCard } from '../engine/cards.js'
const SLOTS = ['gk', 'df', 'mf', 'fw']
const detail = ref(null), filter = ref('all'), listEl = ref(null), detailHeading = ref(null)
let listScroll = 0, lastId = null, replaying = false
const wins = computed(() => store.history.filter(m => m.won).length)
const filters = computed(() => [{ id: 'all', label: 'All', count: store.history.length }, { id: 'wins', label: 'Wins', count: wins.value }, { id: 'losses', label: 'Losses', count: store.history.length - wins.value }])
const filtered = computed(() => store.history.filter(m => filter.value === 'all' || (filter.value === 'wins' ? m.won : !m.won)))
const detailGoals = computed(() => (detail.value?.script?.events || []).filter(e => e.type === 'GOAL'))
const money = n => n.toLocaleString('en-NG')
const signed = n => (n >= 0 ? '+' : '−') + Math.abs(n)
const signedCash = n => (n >= 0 ? '+' : '−') + '₦' + money(Math.abs(n))
const initials = name => name.slice(0, 2).toUpperCase()
const arenaName = fee => fee < 50 ? 'Practice Arena' : fee < 200 ? 'Home Arena' : 'Pro Arena'
function yourScore (m) { return m.aIsHome ? (m.wentToPk ? m.pk.home : m.homeScore) : (m.wentToPk ? m.pk.away : m.awayScore) }
function rivalScore (m) { return m.aIsHome ? (m.wentToPk ? m.pk.away : m.awayScore) : (m.wentToPk ? m.pk.home : m.homeScore) }
function recordLabel (m) { return `${m.won ? 'Won' : 'Lost'} against ${m.opponent.handle}, you ${yourScore(m)} to ${rivalScore(m)}${m.wentToPk ? ' on penalties' : ''}, net ${signedCash(m.net)}, ${signed(m.rankDelta)} rank. View match details` }
function teamOf (side) { return (side === 'HOME') === detail.value.aIsHome ? 'You' : detail.value.opponent.handle }
function snapCard (s) { return buildCard(BY_ID[s.id], s.level) }
async function openDetail (m) { listScroll = listEl.value.scrollTop; lastId = m.id; detail.value = m; await nextTick(); detailHeading.value?.focus({ preventScroll: true }) }
async function closeDetail () { detail.value = null; await nextTick(); if (listEl.value) { listEl.value.scrollTop = listScroll; [...listEl.value.querySelectorAll('.row')].find(el => el.dataset.matchId === lastId)?.focus({ preventScroll: true }) } }
function replay () { if (replaying) return; replaying = true; startReplay(detail.value) }
watch(detail, v => { screenBack.value = v ? closeDetail : null }, { immediate: true })
onUnmounted(() => { screenBack.value = null })
function dateLabel (t) { return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t) }
function ago (t) { const m = Math.max(0, Math.floor((Date.now() - t) / 60000)); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m / 60); return h < 24 ? h + 'h ago' : Math.floor(h / 24) + 'd ago' }
</script>

<style scoped>
.hi { display:flex; flex:1; min-height:0; background:#0c1621; }
.history-list,.history-detail { min-width:0; width:100%; }
.history-list { background:linear-gradient(#07131e22,#0c1621 430px),url('../assets/matchmaking-art/stadium.webp') center top/430px auto no-repeat; }
.history-hero { padding:24px 20px 18px; background:linear-gradient(180deg,#0a152333,#0b1726a8); }
.eyebrow { margin:0; color:#b9cbdc; letter-spacing:.18em; font-size:9px; font-weight:800; }
.history-hero h1 { font-size:32px; line-height:1.06; letter-spacing:-.045em; margin:10px 0; }
.hero-caption { margin:0; font-size:12px; color:#d1dce7; max-width:260px; }
dl,dd { margin:0; }
dt { color:#aebfce; font-size:10px; }.archive-body { display:flex; flex-direction:column; gap:11px; padding:0 16px 20px; }
.history-filters { display:flex; padding:4px; gap:4px; background:#182734; border:1px solid #839bb13b; border-radius:13px; }
.history-filters button { flex:1; min-width:0; min-height:44px; border-radius:9px; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:7px; color:#b9cadb; }.history-filters button[aria-pressed=true] { background:#304454; color:#fff; box-shadow:inset 0 0 0 1px #a5bdce44,0 2px 5px #0002; }.history-filters button span { font-size:10px; color:#c5d4df; background:#ffffff12; padding:1px 5px; border-radius:5px; }
.list-heading,.section-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }.list-heading { padding:8px 0 2px; }.list-heading h2,.section-heading h2 { font-size:14px; font-weight:800; letter-spacing:-.02em; }.list-heading > span,.section-heading > span { color:#a4b8ca; font-size:10px; }
.row { flex:none; width:100%; text-align:left; border:1px solid #7a94ac44; border-radius:14px; background:linear-gradient(125deg,#223342ed,#152330f2); padding:11px 13px; box-shadow:0 4px 14px #0002; }
.record-top { display:flex; align-items:center; gap:8px; }.result-tag { display:inline-flex; align-items:center; gap:5px; font-size:9px; font-weight:800; letter-spacing:.08em; color:#7aefad; }.result-tag > span { display:flex; align-items:center; justify-content:center; height:17px; width:17px; border:1px solid #50d88c99; border-radius:50%; background:#2ce77e12; font-size:11px; }.lost .result-tag { color:#ff94a0; }.lost .result-tag > span { border-color:#ff829266; background:#fa738510; }
.record-top time { margin-left:auto; color:#a9bcce; font-size:9px; }.record-arrow { color:#b0c5d7; font-size:23px; line-height:18px; }
.record-main { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 0 11px; }.record-opponent { display:flex; flex-direction:column; gap:5px; min-width:0; }.opponent-name { font-size:15px; font-weight:750; overflow-wrap:anywhere; }.record-arena { font-size:10px; color:#b4c6d6; }.record-score { text-align:center; flex:none; min-width:80px; }.record-score b { display:block; font-size:25px; line-height:1.05; font-weight:800; font-variant-numeric:tabular-nums; }.record-score > span { display:block; margin-top:4px; font-size:7px; letter-spacing:.1em; color:#b6c8da; }
.record-bottom { display:flex; align-items:center; gap:8px; border-top:1px solid #b1c6d51f; padding-top:9px; }.record-net { display:flex; align-items:baseline; gap:5px; font-size:15px; line-height:1.1; font-weight:800; font-variant-numeric:tabular-nums; }.record-net small { font-size:9px; font-weight:400; color:#aebfce; }.record-rank { margin-left:auto; font-size:10px; font-weight:600; }.ninety-score { color:#a9bdce; font-size:9px; }.up { color:#73efac; }.down { color:#ff94a0; }
.archive-footnote { color:#92a9bf; font-size:10px; text-align:center; margin:7px 0 0; }.history-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:43px 24px; gap:14px; color:#acc1d3; border:1px dashed #7e97ad66; border-radius:16px; }.history-empty h2 { font-size:19px; color:#edf4fa; }.history-empty p { margin:0; max-width:260px; font-size:12px; line-height:1.6; }
.history-detail { flex:1; display:flex; flex-direction:column; min-height:0; background:linear-gradient(#07131e77,#0c1621f5 420px),url('../assets/matchmaking-art/stadium.webp') center top/430px auto no-repeat; }
.detail-scroll { min-height:0; padding:12px 16px 10px; display:flex; flex-direction:column; gap:10px; }.detail-scroll > * { flex-shrink:0; }
.detail-hero { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:28px; }.detail-hero h1 { color:#ff94a0; font-size:25px; line-height:1.05; font-weight:900; letter-spacing:-.04em; outline:none; }.detail-hero.won h1 { color:#f1d183; }.rank-change { font-size:10px; font-weight:700; border:1px solid #91b0c32b; background:#1024328c; border-radius:6px; padding:4px 7px; }
.panel { border:1px solid #8ca5b154; border-radius:12px; background:linear-gradient(130deg,#263b49b8,#112331c9); }.detail-score { overflow:hidden; }.score-grid { display:grid; grid-template-columns:minmax(0,1fr) 120px minmax(0,1fr); align-items:center; gap:6px; padding:8px 10px; }.score-team { display:flex; flex-direction:column; align-items:center; gap:3px; min-width:0; }.score-team :deep(.duel-crest) { width:30px; }.score-team :deep(b) { font-size:13px; }.score-team > span { display:flex; align-items:center; justify-content:center; gap:4px; max-width:100%; overflow-wrap:anywhere; font-size:10px; font-weight:700; line-height:1.2; }.score-team i,.goal-team i { width:5px; height:7px; border-radius:1px; flex:none; }.home i { background:var(--home); }.away i { background:var(--away); }.score-tally { display:flex; flex-direction:column; align-items:center; gap:3px; }.detail-score h2 { color:#b7cbdb; font-size:8px; font-weight:750; letter-spacing:.12em; }.sc { display:flex; align-items:center; justify-content:center; gap:8px; font-size:34px; line-height:1; font-weight:850; font-variant-numeric:tabular-nums; }.sc > span { font-size:23px; color:#95adbf; }.regular-score { display:flex; align-items:baseline; gap:5px; font-size:10px; font-weight:700; color:#d9e5ee; }.regular-score > span { font-weight:400; font-size:8px; color:#afc4d4; }
.goals-panel { border-top:1px solid #a8bdca26; }.goals-panel summary,.bet-details summary { display:flex; align-items:center; gap:7px; min-height:44px; cursor:pointer; list-style:none; }.goals-panel summary { padding:0 11px; }.goals-panel summary > span { font-size:12px; font-weight:650; }.goals-panel summary small { margin-left:auto; font-size:9px; color:#adc3d6; }.goals-panel summary > i,.bet-details summary > i { font-size:18px; font-style:normal; color:#b8cddd; }.goals-panel[open] summary > i,.bet-details[open] summary > i { transform:rotate(180deg); }summary::-webkit-details-marker { display:none; }.goals { padding:0 11px 4px; }.goal-row { display:flex; align-items:center; gap:9px; padding:8px 0; border-top:1px solid #a9bfce26; }.goal-minute { width:25px; flex:none; color:#afc3d4; font-size:10px; }.goal-row > div { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }.goal-row b { font-size:11px; }.goal-team { display:flex; align-items:center; gap:4px; color:#b8ccdb; font-size:9px; overflow-wrap:anywhere; }.goal-word { font-size:8px; font-weight:800; color:#d3e1ec; }.no-goals { margin:0; padding:0 11px 10px; color:#b3c8d8; font-size:10px; }
.section-heading { margin:0 0 6px; }.section-heading h2 { font-size:12px; }.section-heading > span { font-size:9px; }.deck { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }.squad-slot { min-width:0; }.squad-slot :deep(.cf) { width:100%; max-width:82px; margin-inline:auto; }
.settlement { border-top:1px solid #91a9ba33; padding-top:8px; }.settlement > h2 { margin:0 0 3px; font-size:9px; font-weight:750; color:#b7ccdd; letter-spacing:.12em; }.bet-summary > div { display:flex; justify-content:space-between; align-items:center; gap:12px; min-height:25px; border-bottom:1px solid #a9bfce1c; }.bet-summary dt { font-size:12px; color:#bccddd; }.bet-summary dt small { margin-left:4px; color:#8fa9be; font-size:8px; }.bet-summary dd { font-size:13px; font-weight:750; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; text-align:right; }.bet-summary .net-row { min-height:30px; }.net-row dd { font-size:20px; font-weight:850; letter-spacing:-.03em; }.bet-details summary { gap:8px; }.bet-details summary > span { font-size:12px; font-weight:650; }.bet-details summary > small { margin-left:auto; color:#a9c0d2; font-size:9px; font-variant-numeric:tabular-nums; }.bet-details dl > div { display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-top:1px solid #a9bfce1c; }.bet-details dd { font-size:11px; text-align:right; }.bet-details .quoted dd { font-size:9px; }.calculation { margin:5px 0 0; padding:7px 0 0; border-top:1px solid #a9bfce1c; color:#b4c7d7; font-size:10px; line-height:1.5; }.promo { display:flex; align-items:center; gap:8px; margin-top:8px; padding:8px; background:#a7872710; border-left:2px solid #c3a469; color:#f7d78e; }.promo > div { display:flex; flex:1; min-width:0; flex-direction:column; gap:3px; }.promo small { font-size:7px; letter-spacing:.1em; }.promo b { font-size:11px; }.promo > span { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:750; }
.history-actions { flex:none; padding:8px 16px 7px; border-top:1px solid #93acc22b; background:#0d1a28f5; }.history-actions button { height:44px; min-height:44px; border-radius:10px; gap:8px; font-size:14px; }.history-actions button > span { font-size:11px; }.history-actions p { margin:4px 0 0; text-align:center; font-size:8px; line-height:1.3; color:#a6bed2; }
button:focus-visible,summary:focus-visible { outline:2px solid #79e3af; outline-offset:3px; }
@media(max-width:350px) { .history-hero { padding:21px 14px 16px; }.history-hero h1 { font-size:29px; }.archive-body { padding-left:12px; padding-right:12px; }.record-main { gap:8px; }.opponent-name { font-size:13px; }.record-score { min-width:70px; }.record-score b { font-size:23px; }.detail-scroll { padding:10px 12px 8px; gap:8px; }.detail-hero { min-height:26px; }.detail-hero h1 { font-size:23px; }.score-grid { grid-template-columns:minmax(0,1fr) 100px minmax(0,1fr); gap:4px; padding:7px 8px; }.score-team > span { font-size:9px; }.sc { font-size:31px; }.deck { gap:5px; }.history-actions { padding-left:12px; padding-right:12px; } }
</style>
