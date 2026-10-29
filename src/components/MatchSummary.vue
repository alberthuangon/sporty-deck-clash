<template>
  <section class="match-summary" :class="{ won: match.won }" aria-label="Match summary">
    <div class="summary-content scroll">
      <header class="summary-hero">
        <span class="complete-pill">MATCH COMPLETE</span>
        <div class="summary-emblem">
          <img v-if="match.won" :src="emblemArt" width="256" height="256" alt="" aria-hidden="true" />
          <DuelCrest v-else label="SK" />
        </div>
        <h1 ref="headingEl" tabindex="-1" aria-describedby="summary-description">{{ match.won ? 'VICTORY' : 'DEFEAT' }}</h1>
        <p id="summary-description">{{ match.wentToPk ? (match.won ? 'You won the shootout.' : 'Lost on penalties.') : (match.won ? 'Your squad wins.' : 'Full-time result.') }}</p>
      </header>

      <section class="summary-score" aria-label="Final score">
        <h2>{{ match.wentToPk ? 'PENALTY SHOOTOUT' : 'FULL TIME' }}</h2>
        <div class="summary-score-grid">
          <div class="summary-team home">
            <DuelCrest :label="match.aIsHome ? 'SK' : opponentInitials" />
            <span class="team-label"><i aria-hidden="true"></i>{{ homeName }}</span>
          </div>
          <div class="primary-score"><b>{{ primaryHome }}</b><span>:</span><b>{{ primaryAway }}</b></div>
          <div class="summary-team away">
            <DuelCrest :label="match.aIsHome ? opponentInitials : 'SK'" />
            <span class="team-label"><i aria-hidden="true"></i>{{ awayName }}</span>
          </div>
        </div>
        <div v-if="match.wentToPk" class="regular-score"><b>{{ match.homeScore }} : {{ match.awayScore }}</b><span>after 90 minutes</span></div>
      </section>

      <details class="summary-highlights">
        <summary><Icon name="missions" :size="22" /><span>Match highlights<small>{{ match.wentToPk ? 'Goals & shootout' : 'Scoring moments' }}</small></span><i aria-hidden="true">⌄</i></summary>
        <ul v-if="highlights.length" class="highlight-list">
          <li v-for="(event, i) in highlights" :key="i" :class="event.side.toLowerCase()">
            <span class="highlight-time">{{ event.round ? 'R' + event.round : event.minute + "'" }}</span>
            <span class="highlight-player"><b>{{ event.shooterName || event.actorName }}</b><small>{{ event.side === 'HOME' ? homeName : awayName }}{{ event.keeperName ? ' · vs ' + event.keeperName : '' }}{{ event.suddenDeath ? ' · Sudden death' : '' }}</small></span>
            <span class="highlight-outcome" :class="{ goal: (event.outcome || event.type) === 'GOAL' }">{{ event.outcome || event.type }}</span>
          </li>
        </ul>
        <p v-else class="no-highlights">No scoring highlights.</p>
      </details>
    </div>
    <footer class="summary-actions">
      <button class="btn btn-cta" :disabled="busy" data-result-action @click="$emit('proceed')">{{ replay ? 'Done' : 'View result' }}<span aria-hidden="true">›</span></button>
      <p>{{ replay ? 'Return to match history' : 'See payout and rank progress' }}</p>
    </footer>
  </section>
</template>
<script setup>
import { computed, ref, onMounted } from 'vue'
import DuelCrest from './DuelCrest.vue'
import Icon from './Icon.vue'
import emblemArt from '../assets/victory-art/emblem.webp'
const props = defineProps({ match: { type: Object, required: true }, script: { type: Object, required: true }, homeName: String, awayName: String, replay: Boolean, busy: Boolean })
defineEmits(['proceed'])
const headingEl = ref(null)
const opponentInitials = computed(() => props.match.opponentName.slice(0, 2).toUpperCase())
const primaryHome = computed(() => props.match.wentToPk ? props.match.pkHome : props.match.homeScore)
const primaryAway = computed(() => props.match.wentToPk ? props.match.pkAway : props.match.awayScore)
const highlights = computed(() => [...props.script.events.filter(e => e.type === 'GOAL'), ...(props.script.penalty?.events || [])])
onMounted(() => headingEl.value?.focus({ preventScroll: true }))
</script>
<style scoped>
.match-summary { flex: 1; min-height: 0; display: flex; flex-direction: column; background: linear-gradient(180deg,#06111eb3,#07121de8 70%,#07121df2),url('../assets/matchmaking-art/stadium.webp') center/cover; }
.summary-content { display: flex; flex-direction: column; gap: 18px; min-height: 0; padding: 24px 20px; scrollbar-width: none; }
.summary-content::-webkit-scrollbar { display: none; }
.summary-content > * { flex-shrink: 0; }
.summary-hero { display: flex; flex-direction: column; align-items: center; gap: 9px; text-align: center; }
.complete-pill { display: inline-flex; align-items: center; justify-content: center; min-height: 27px; padding: 4px 16px; border: 1px solid #91a6b980; border-radius: 999px; font-size: 9px; font-weight: 800; letter-spacing: .18em; color: #d8e3ed; }
.won .complete-pill { color: #f6d589; border-color: #d6b268; }
.summary-emblem { display: flex; align-items: center; justify-content: center; height: 104px; width: 120px; margin-top: 3px; }
.summary-emblem img { display: block; width: 104px; height: 104px; object-fit: contain; filter: drop-shadow(0 4px 14px #d89a2225); }
.summary-emblem :deep(.duel-crest) { width: 77px; }
.summary-emblem :deep(b) { font-size: 30px; }
h1 { margin: 0; font-size: 44px; font-weight: 900; line-height: 1.05; letter-spacing: -.035em; color: #ff8995; outline: none; }
.won h1 { color: #f9db91; background: linear-gradient(180deg,#fff0c0,#e9bb54 62%,#ad7a2d); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0 2px 1px #372308); }
.summary-hero p { margin: 0; color: #e3eaf2; font-size: 14px; }
.summary-score { padding: 15px 13px 16px; border: 1px solid #8ba0b665; border-radius: 16px; background: linear-gradient(130deg,#1b2b39dc,#0a1825e8); box-shadow: inset 0 1px 0 #ffffff08; }
.won .summary-score { border-color: #bb985d99; }
h2 { margin: 0 0 15px; text-align: center; color: #bdcddd; font-size: 10px; font-weight: 700; letter-spacing: .18em; }
.summary-score-grid { display: grid; grid-template-columns: minmax(0,1fr) 136px minmax(0,1fr); align-items: center; gap: 5px; }
.summary-team { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.summary-team :deep(.duel-crest) { width: 56px; }
.summary-team :deep(b) { font-size: 22px; }
.team-label { max-width: 100%; display: flex; justify-content: center; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.team-label i { display: inline-block; flex: none; width: 7px; height: 9px; border-radius: 2px; }
.home .team-label i { background: var(--home); }.away .team-label i { background: var(--away); }
.primary-score { display: flex; align-items: center; justify-content: center; gap: 11px; padding-bottom: 20px; font-size: 50px; font-weight: 900; line-height: 1.1; font-variant-numeric: tabular-nums; }
.primary-score span { font-size: 33px; color: #a8bbcd; }
.regular-score { display: flex; flex-direction: column; gap: 3px; align-items: center; width: 60%; margin: 12px auto 0; padding-top: 10px; border-top: 1px solid #a2b8ca33; }
.regular-score b { font-size: 17px; font-variant-numeric: tabular-nums; letter-spacing: .06em; }.regular-score span { color: #aebfd0; font-size: 10px; }
.summary-highlights { border: 1px solid #879db466; border-radius: 14px; background: #152331c9; }
summary { display: flex; align-items: center; min-height: 62px; padding: 12px 15px; gap: 13px; cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }summary > span { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 13px; }summary small { font-size: 10px; font-weight: 400; color: #b2c3d5; }summary > i { margin-left: auto; font-size: 22px; font-style: normal; color: #bdcedf; }details[open] summary > i { transform: rotate(180deg); }
.highlight-list { padding: 0 13px 7px; }.highlight-list li { display: flex; align-items: center; gap: 8px; border-top: 1px solid #a1b5ca1e; padding: 11px 0; }
.highlight-time { width: 28px; flex: none; font-size: 10px; font-weight: 800; color: #b0c0d1; }.highlight-player { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 3px; }.highlight-player b { font-size: 12px; }.highlight-player small { font-size: 9px; color: #aebfd0; overflow-wrap: anywhere; }.highlight-outcome { flex: none; padding: 3px 5px; border: 1px solid #879bb744; border-radius: 5px; font-size: 8px; color: #bac8d9; }.home .highlight-outcome.goal { color: var(--home-on); border-color: #ff7f8c55; }.away .highlight-outcome.goal { color: var(--away-on); border-color: #76b0ff55; }.no-highlights { padding: 0 15px 12px; color: #b0c3d6; font-size: 12px; }
.summary-actions { flex: none; padding: 15px 20px 14px; background: #0a1522e6; border-top: 1px solid #8a9db52b; }.summary-actions button { position: relative; height: 48px; min-height: 48px; border-radius: 12px; font-size: 16px; }.summary-actions button span { position: absolute; right: 23px; font-size: 29px; font-weight: 400; line-height: 1; }.summary-actions p { margin: 9px 0 0; color: #b4c7da; text-align: center; font-size: 10px; }summary:focus-visible,button:focus-visible { outline: 2px solid #85eab4; outline-offset: 3px; }
@media(max-width:350px) { .summary-content { padding: 18px 12px; gap: 13px; }.summary-hero { gap: 8px; }.summary-emblem { height: 88px; }.summary-emblem img { width: 88px; height: 88px; }.summary-emblem :deep(.duel-crest) { width: 66px; }h1 { font-size: 36px; }.summary-hero p { font-size: 12px; }.complete-pill { font-size: 8px; }.summary-score { padding: 13px 10px; }.summary-score-grid { grid-template-columns: minmax(0,1fr) 100px minmax(0,1fr); gap: 3px; }.primary-score { font-size: 40px; gap: 7px; }.primary-score span { font-size: 27px; }.summary-team :deep(.duel-crest) { width: 46px; }.summary-team :deep(b) { font-size: 18px; }.team-label { font-size: 10px; }.summary-actions { padding-left: 12px; padding-right: 12px; } }
</style>
