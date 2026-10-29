<template>
  <div class="hi">
    <div v-if="!detail" ref="listEl" class="history-list scroll">
      <header class="history-hero">
        <p class="eyebrow">YOUR MATCH ARCHIVE</p>
        <h1>Your match record.</h1>
        <p class="hero-caption">Results, rewards and every replay.</p>
        <dl class="archive-stats">
          <div><dt>Saved matches</dt><dd>{{ store.history.length }}</dd></div>
          <div><dt>Wins</dt><dd>{{ wins }}</dd></div>
          <div><dt>Net result</dt><dd :class="netTotal < 0 ? 'down' : 'up'">{{ signedCash(netTotal) }}</dd></div>
        </dl>
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
          <div class="detail-nav"><button class="back" @click="closeDetail"><span aria-hidden="true">‹</span> All matches</button><time :datetime="new Date(detail.at).toISOString()">{{ dateLabel(detail.at) }}</time></div>
          <p class="eyebrow">MATCH COMPLETE</p>
          <h1 ref="detailHeading" tabindex="-1">{{ detail.won ? 'VICTORY' : 'DEFEAT' }}</h1>
          <p class="outcome-caption">{{ detail.wentToPk ? (detail.won ? 'You won the shootout.' : 'Decided on penalties.') : 'The final whistle. The full story.' }}</p>
          <section class="detail-score panel" aria-label="Final score">
            <h2>{{ detail.wentToPk ? 'PENALTY SHOOTOUT' : 'FULL TIME' }}</h2>
            <div class="score-grid">
              <div class="score-team home"><DuelCrest :label="detail.aIsHome ? 'SK' : initials(detail.opponent.handle)" /><span><i aria-hidden="true"></i>{{ detail.aIsHome ? 'You' : detail.opponent.handle }}</span></div>
              <div class="sc">{{ detail.wentToPk ? detail.pk.home : detail.homeScore }}<span>:</span>{{ detail.wentToPk ? detail.pk.away : detail.awayScore }}</div>
              <div class="score-team away"><DuelCrest :label="detail.aIsHome ? initials(detail.opponent.handle) : 'SK'" /><span><i aria-hidden="true"></i>{{ detail.aIsHome ? detail.opponent.handle : 'You' }}</span></div>
            </div>
            <div v-if="detail.wentToPk" class="regular-score">{{ detail.homeScore }} : {{ detail.awayScore }}<span>after 90 minutes</span></div>
          </section>
        </header>
        <div class="detail-body">
          <section class="settlement panel" aria-labelledby="settlement-title">
            <div class="settlement-top"><h2 id="settlement-title">MATCH SETTLEMENT</h2><span class="rank-change" :class="detail.rankDelta < 0 ? 'down' : 'up'">{{ signed(detail.rankDelta) }} rank</span></div>
            <p class="net-label">{{ detail.net >= 0 ? 'Net profit' : 'Net loss' }}</p>
            <div class="net-amount" :class="detail.net < 0 ? 'down' : 'up'">{{ signedCash(detail.net) }}</div>
            <dl class="settlement-totals"><div><dt>Stake</dt><dd>₦{{ money(detail.stake) }}</dd></div><div><dt>Total payout <small>including stake</small></dt><dd>₦{{ money(detail.payout) }}</dd></div></dl>
            <details class="bet-details"><summary>Bet details<span aria-hidden="true">⌄</span></summary><dl><div><dt>Arena</dt><dd>{{ arenaName(detail.tierFee) }} · ₦{{ money(detail.tierFee) }}</dd></div><div><dt>Your side</dt><dd>{{ detail.aIsHome ? 'HOME' : 'AWAY' }}</dd></div><div><dt>Settled odds</dt><dd>{{ detail.odds.toFixed(2) }}</dd></div><div class="quoted"><dt>Quoted odds</dt><dd>Home {{ detail.oddsIfHome.toFixed(2) }} · Away {{ detail.oddsIfAway.toFixed(2) }}</dd></div></dl><p v-if="detail.won" class="calculation">₦{{ money(detail.stake) }} × {{ detail.odds.toFixed(2) }} = {{ (detail.stake * detail.odds).toFixed(2) }}<br>Payout rounded down to ₦{{ money(detail.payout) }}.</p><p v-else class="calculation">Stake ₦{{ money(detail.stake) }} · Payout ₦{{ money(detail.payout) }}</p></details>
          </section>
          <section class="saved-squad" aria-labelledby="squad-title"><div class="section-heading"><h2 id="squad-title">Your squad</h2><span>At kick-off</span></div><div class="deck"><div v-for="s in SLOTS" :key="s" class="squad-slot"><span class="slot-label">{{ s.toUpperCase() }}</span><CardFace :card="snapCard(detail.decks.you[s])" size="sm" full /></div></div></section>
          <details class="goals-panel panel"><summary><Icon name="play" :size="19" /><span>Match goals<small>{{ detailGoals.length }} {{ detailGoals.length === 1 ? 'goal' : 'goals' }} in 90 minutes</small></span><i aria-hidden="true">⌄</i></summary><div v-if="detailGoals.length" class="goals"><div v-for="(g,i) in detailGoals" :key="i" class="goal-row" :class="g.side.toLowerCase()"><span class="goal-minute">{{ g.minute }}′</span><div><b>{{ g.actorName }}</b><span class="goal-team"><i aria-hidden="true"></i>{{ teamOf(g.side) }}</span></div><span class="goal-word">GOAL</span></div></div><p v-else class="no-goals">No goals in regular time.</p></details>
          <div v-for="p in detail.promotions" :key="p.id" class="promo"><Icon name="rank" :size="24" /><div><small>RANK REWARD</small><b>{{ p.label }}</b></div><span v-if="p.reward.diamonds"><DiamondIcon :size="18" />{{ p.reward.diamonds }}</span><span v-if="p.reward.tickets"><Icon name="ticket" :size="20" />{{ p.reward.tickets }}</span></div>
        </div>
      </div>
      <footer class="history-actions"><button class="btn btn-cta" @click="replay"><span aria-hidden="true">▶</span> Replay this match</button><p>Watch the saved match. Results and balance stay unchanged.</p></footer>
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
const netTotal = computed(() => store.history.reduce((sum, m) => sum + m.net, 0))
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
.archive-stats { display:grid; grid-template-columns:1fr .7fr 1.4fr; margin-top:22px; border:1px solid #8fa4b53d; border-radius:13px; background:#13222dd9; padding:13px 0; backdrop-filter:blur(8px); }
.archive-stats > div { min-width:0; padding:0 13px; border-right:1px solid #9eb7c52b; }.archive-stats > div:last-child { border:0; }dt { color:#aebfce; font-size:10px; }.archive-stats dd { margin-top:5px; font-size:21px; font-weight:800; line-height:24px; min-height:24px; overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }.archive-stats div:last-child dd { font-size:19px; }
.archive-body { display:flex; flex-direction:column; gap:11px; padding:0 16px 20px; }
.history-filters { display:flex; padding:4px; gap:4px; background:#182734; border:1px solid #839bb13b; border-radius:13px; }
.history-filters button { flex:1; min-width:0; min-height:44px; border-radius:9px; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:7px; color:#b9cadb; }.history-filters button[aria-pressed=true] { background:#304454; color:#fff; box-shadow:inset 0 0 0 1px #a5bdce44,0 2px 5px #0002; }.history-filters button span { font-size:10px; color:#c5d4df; background:#ffffff12; padding:1px 5px; border-radius:5px; }
.list-heading,.section-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }.list-heading { padding:8px 0 2px; }.list-heading h2,.section-heading h2 { font-size:14px; font-weight:800; letter-spacing:-.02em; }.list-heading > span,.section-heading > span { color:#a4b8ca; font-size:10px; }
.row { flex:none; width:100%; text-align:left; border:1px solid #7a94ac44; border-radius:14px; background:linear-gradient(125deg,#223342ed,#152330f2); padding:11px 13px; box-shadow:0 4px 14px #0002; }
.record-top { display:flex; align-items:center; gap:8px; }.result-tag { display:inline-flex; align-items:center; gap:5px; font-size:9px; font-weight:800; letter-spacing:.08em; color:#7aefad; }.result-tag > span { display:flex; align-items:center; justify-content:center; height:17px; width:17px; border:1px solid #50d88c99; border-radius:50%; background:#2ce77e12; font-size:11px; }.lost .result-tag { color:#ff94a0; }.lost .result-tag > span { border-color:#ff829266; background:#fa738510; }
.record-top time { margin-left:auto; color:#a9bcce; font-size:9px; }.record-arrow { color:#b0c5d7; font-size:23px; line-height:18px; }
.record-main { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 0 11px; }.record-opponent { display:flex; flex-direction:column; gap:5px; min-width:0; }.opponent-name { font-size:15px; font-weight:750; overflow-wrap:anywhere; }.record-arena { font-size:10px; color:#b4c6d6; }.record-score { text-align:center; flex:none; min-width:80px; }.record-score b { display:block; font-size:25px; line-height:1.05; font-weight:800; font-variant-numeric:tabular-nums; }.record-score > span { display:block; margin-top:4px; font-size:7px; letter-spacing:.1em; color:#b6c8da; }
.record-bottom { display:flex; align-items:center; gap:8px; border-top:1px solid #b1c6d51f; padding-top:9px; }.record-net { display:flex; align-items:baseline; gap:5px; font-size:15px; line-height:1.1; font-weight:800; font-variant-numeric:tabular-nums; }.record-net small { font-size:9px; font-weight:400; color:#aebfce; }.record-rank { margin-left:auto; font-size:10px; font-weight:600; }.ninety-score { color:#a9bdce; font-size:9px; }.up { color:#73efac; }.down { color:#ff94a0; }
.archive-footnote { color:#92a9bf; font-size:10px; text-align:center; margin:7px 0 0; }.history-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:43px 24px; gap:14px; color:#acc1d3; border:1px dashed #7e97ad66; border-radius:16px; }.history-empty h2 { font-size:19px; color:#edf4fa; }.history-empty p { margin:0; max-width:260px; font-size:12px; line-height:1.6; }
.history-detail { flex:1; display:flex; flex-direction:column; min-height:0; background:linear-gradient(#07131e77,#0c1621eb 600px),url('../assets/matchmaking-art/stadium.webp') center top/430px auto no-repeat; }.detail-scroll { min-height:0; }.detail-hero { padding:0 18px 0; text-align:center; }.detail-nav { display:flex; align-items:center; justify-content:space-between; gap:6px; margin:0 -6px 13px; }.back { min-height:44px; display:flex; align-items:center; gap:5px; padding:0 6px; font-size:11px; color:#cedbe6; }.back > span { font-size:23px; }.detail-nav time { font-size:9px; color:#b3c5d5; }.detail-hero h1 { margin-top:6px; font-size:35px; letter-spacing:-.04em; line-height:1.1; color:#ff94a0; outline:none; }.detail-hero.won h1 { color:#f1d183; }.outcome-caption { font-size:12px; color:#c5d4e0; margin:7px 0 16px; }
.panel { border:1px solid #859fb34d; border-radius:15px; background:linear-gradient(135deg,#20313fe8,#111f2beb); box-shadow:inset 0 1px 0 #ffffff06; }.detail-score { padding:15px 13px 13px; }.detail-score h2 { font-size:9px; color:#bdcfdf; letter-spacing:.16em; font-weight:800; margin-bottom:12px; }.won .detail-score { border-color:#bc9a5c77; }.score-grid { display:grid; grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr); gap:6px; align-items:center; }.score-team { min-width:0; display:flex; flex-direction:column; align-items:center; gap:7px; }.score-team :deep(.duel-crest) { width:47px; }.score-team :deep(b) { font-size:20px; }.score-team > span { display:flex; align-items:center; gap:4px; justify-content:center; font-size:11px; font-weight:700; max-width:100%; overflow-wrap:anywhere; }.score-team i,.goal-team i { width:6px; height:8px; border-radius:2px; flex:none; }.home i { background:var(--home); }.away i { background:var(--away); }.sc { display:flex; align-items:center; justify-content:center; gap:10px; font-size:44px; font-weight:850; line-height:1; font-variant-numeric:tabular-nums; padding-bottom:17px; }.sc > span { color:#94adbf; font-size:29px; }.regular-score { display:flex; flex-direction:column; gap:2px; font-size:15px; font-weight:700; border-top:1px solid #9eb5c22b; width:55%; padding-top:8px; margin:12px auto 0; }.regular-score > span { font-size:9px; color:#afc4d5; font-weight:400; }
.detail-body { display:flex; flex-direction:column; padding:15px 18px 18px; gap:16px; }.settlement { padding:15px; }.settlement-top { display:flex; align-items:center; justify-content:space-between; gap:5px; }.settlement-top h2 { font-size:9px; letter-spacing:.13em; color:#b6cad9; }.rank-change { font-size:10px; font-weight:700; background:#b5cddd0d; border:1px solid #93adc52b; border-radius:6px; padding:4px 7px; }.net-label { margin:12px 0 1px; color:#c7d5df; font-size:11px; }.net-amount { font-size:31px; font-weight:850; letter-spacing:-.03em; line-height:1.15; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }.settlement-totals { display:grid; grid-template-columns:1fr 1.3fr; margin-top:14px; padding-top:12px; border-top:1px solid #a9bfce26; }.settlement-totals > div + div { padding-left:16px; border-left:1px solid #a9bfce26; }.settlement-totals dt { min-height:27px; display:flex; flex-direction:column; gap:2px; }.settlement-totals dt small { font-size:8px; color:#94aabc; }.settlement-totals dd { font-size:17px; font-weight:800; margin-top:5px; }.bet-details { margin-top:13px; border-top:1px solid #a9bfce26; }.bet-details summary { display:flex; align-items:center; justify-content:space-between; min-height:44px; font-size:11px; font-weight:700; list-style:none; cursor:pointer; }.bet-details summary > span { font-size:20px; }.bet-details[open] summary > span { transform:rotate(180deg); }.bet-details dl > div { display:flex; justify-content:space-between; align-items:baseline; gap:10px; padding:7px 0; }.bet-details dd { font-size:11px; text-align:right; }.bet-details .quoted dd { font-size:9px; }.calculation { margin:6px 0 2px; padding-top:9px; border-top:1px solid #a9bfce26; font-size:10px; line-height:1.6; color:#b4c7d7; }
.section-heading { margin-bottom:10px; }.deck { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }.squad-slot { min-width:0; }.slot-label { display:block; text-align:center; margin-bottom:5px; color:#b6cbdc; font-size:9px; font-weight:700; letter-spacing:.12em; }.goals-panel summary { display:flex; align-items:center; gap:10px; padding:12px 14px; min-height:60px; list-style:none; cursor:pointer; }.goals-panel summary > span { display:flex; flex-direction:column; gap:4px; font-size:12px; font-weight:700; }.goals-panel small { font-size:9px; color:#afc3d4; font-weight:400; }.goals-panel summary > i { margin-left:auto; font-style:normal; font-size:20px; }.goals-panel[open] summary > i { transform:rotate(180deg); }summary::-webkit-details-marker { display:none; }.goals { padding:0 14px 7px; }.goal-row { display:flex; align-items:center; gap:10px; padding:10px 0; border-top:1px solid #a9bfce26; }.goal-minute { font-size:10px; color:#afc3d4; width:25px; flex:none; }.goal-row > div { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }.goal-row b { font-size:12px; }.goal-team { display:flex; align-items:center; gap:4px; color:#b8ccdb; font-size:9px; overflow-wrap:anywhere; }.goal-word { font-size:8px; font-weight:800; color:#d3e1ec; }.no-goals { margin:0; padding:0 14px 12px; color:#b3c8d8; font-size:11px; }
.promo { display:flex; align-items:center; gap:10px; padding:12px; background:linear-gradient(110deg,#493d24aa,#1e2b35); border:1px solid #c4a36377; border-radius:12px; color:#f7d78e; }.promo > div { display:flex; flex:1; min-width:0; flex-direction:column; gap:4px; }.promo small { font-size:8px; letter-spacing:.12em; }.promo b { font-size:12px; }.promo > span { display:inline-flex; align-items:center; gap:4px; font-size:13px; font-weight:800; }
.history-actions { flex:none; padding:12px 18px 10px; border-top:1px solid #93acc22b; background:#0d1a28f5; }.history-actions button { min-height:46px; border-radius:11px; gap:9px; font-size:15px; }.history-actions button > span { font-size:12px; }.history-actions p { text-align:center; font-size:9px; color:#afc3d6; margin:7px 0 0; }
button:focus-visible,summary:focus-visible { outline:2px solid #79e3af; outline-offset:3px; }
@media(max-width:350px) { .history-hero { padding:21px 14px 16px; }.history-hero h1 { font-size:29px; }.archive-body { padding-left:12px; padding-right:12px; }.archive-stats > div { padding:0 9px; }.archive-stats dd { font-size:19px; }.archive-stats div:last-child dd { font-size:16px; }.record-main { gap:8px; }.opponent-name { font-size:13px; }.record-score { min-width:70px; }.record-score b { font-size:23px; }.detail-hero { padding-left:12px; padding-right:12px; }.detail-body { padding-left:12px; padding-right:12px; }.score-grid { grid-template-columns:minmax(0,1fr) 103px minmax(0,1fr); gap:3px; }.score-team :deep(.duel-crest) { width:40px; }.score-team > span { font-size:9px; }.sc { font-size:37px; gap:7px; }.detail-nav time { font-size:8px; }.deck { gap:5px; }.history-actions { padding-left:12px; padding-right:12px; } }
</style>
