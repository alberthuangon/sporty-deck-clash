<template>
  <div class="stage">
    <!-- scoreboard -->
    <div class="board">
      <div class="side" :class="{ me: homeIsMe }">
        <i class="jersey home"></i>
        <span class="team-id"><small>HOME</small><span class="nm">{{ homeName }}</span></span>
      </div>
      <div class="sc-wrap">
        <div class="sc">
          <b ref="scoreHomeEl">{{ scoreHome }}</b><span>:</span><b ref="scoreAwayEl">{{ scoreAway }}</b>
        </div>
        <div class="sc-pk">{{ pkScore ? 'pens ' + pkScore : '' }}</div>
      </div>
      <div class="side right" :class="{ me: !homeIsMe }">
        <span class="team-id"><small>AWAY</small><span class="nm">{{ awayName }}</span></span>
        <i class="jersey away"></i>
      </div>
    </div>
    <div class="clockbar">
      <span ref="clockEl" class="clk">{{ clockLabel }}</span>
      <span v-if="phaseLabel" class="phase">{{ phaseLabel }}</span>
    </div>

    <!-- pitch, and everything the cut-in may cover. The board and the clock sit ABOVE
         the cut-in on purpose, so the cut-in gets its own box below them
         rather than a hand-measured top offset that rots when they resize -->
    <div class="arena">
      <div class="pitch" ref="pitchEl">
        <div class="turf"></div>

        <!-- One SVG instead of six divs. Divs cannot draw an arc, which is why
             this pitch had no centre spot, no D and no corner arcs and read as
             a tennis court. The viewBox is the pitch's real pixel size, so the
             numbers here are the numbers measured on screen; nothing is drawn
             outside it, because SVG children are subject to the layout gate's
             geometry assertions just like any other element. -->
        <svg class="lines" viewBox="0 0 406 186" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <pattern id="netmesh" width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="rgba(255,255,255,.08)" />
              <path d="M0 0H4M0 0V4" stroke="rgba(255,255,255,.22)" stroke-width=".5" />
            </pattern>
          </defs>
          <!-- The goal spans y 63-123 (34%-66%). It has to: the engine lands a
               scored ball at y 39% or 61% and the ball is 4.8% tall, so it
               occupies 36.6%-63.4%. The old 18.3% goal mouth meant a goal
               finished with the ball's centre OUTSIDE the posts — invisible
               only because the goal was a translucent bar. -->
          <g class="goal">
            <rect class="mesh" x="0" y="63" width="8" height="60" />
            <rect class="mesh" x="398" y="63" width="8" height="60" />
            <path class="post" d="M8 63V123" />
            <path class="post" d="M398 63V123" />
          </g>
          <!-- box, six-yard box and centre circle keep their exact previous
               size: the keeper stands at x=7%, inside the box and outside the
               six, and that relationship is correct as it is -->
          <g class="l1">
            <path d="M203 0V186" />
            <circle cx="203" cy="93" r="26" />
            <path d="M0 41H52V145H0" />
            <path d="M406 41H354V145H406" />
            <path d="M52 69.8A28.8 28.8 0 0 1 52 116.2" />
            <path d="M354 116.2A28.8 28.8 0 0 1 354 69.8" />
          </g>
          <g class="l2">
            <path d="M0 68H20V118H0" />
            <path d="M406 68H386V118H406" />
            <path d="M0 4A4 4 0 0 0 4 0" />
            <path d="M402 0A4 4 0 0 0 406 4" />
            <path d="M406 182A4 4 0 0 0 402 186" />
            <path d="M4 186A4 4 0 0 0 0 182" />
          </g>
          <g class="spot">
            <circle cx="203" cy="93" r="1.8" />
            <circle cx="35" cy="93" r="1.6" />
            <circle cx="371" cy="93" r="1.6" />
          </g>
        </svg>

        <svg class="trail" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path ref="trailEl" d="" />
        </svg>

        <div
          v-for="t in tokenList" :key="t.key"
          class="token" :class="[t.side, { keeper: t.slot === 'gk' }]"
          :ref="el => setToken(t.key, el)"
          :style="{ left: t.x + '%', top: t.y + '%' }"
        >
          <span>{{ t.label }}</span>
          <i class="ring"></i>
        </div>

        <div class="ball" ref="ballEl"></div>
        <div class="flash" ref="flashEl"></div>
        <div class="shock" ref="shockEl"></div>
      </div>

      <!-- cut-in overlay -->
      <div class="cutin" ref="cutinEl">
        <div class="ci-bg" ref="ciBgEl"></div>
        <div class="ci-tint" :class="cutSide" ref="ciTintEl"></div>
        <div class="ci-streaks" ref="ciStreakEl"></div>
        <div class="ci-body" ref="ciBodyEl">
          <!-- the slot is always mounted: the card entrance is compiled before
               setCutIn has run, so a tween aimed at the v-if'd CardFace gets
               null and the card ends up popping in with no animation at all -->
          <div class="ci-card-slot" ref="ciCardEl">
            <CardFace v-if="cutCard" :card="cutCard" size="md" :radar="false" full class="ci-card" />
          </div>
          <div class="ci-team" :class="cutSide" v-if="cutTeam">
            <i class="ci-jersey"></i>{{ cutTeam }}
          </div>
          <div class="ci-text" :class="cutSide" ref="ciTextEl">{{ cutText }}</div>
          <div class="ci-sub">{{ cutSub }}</div>
        </div>
      </div>
    </div>

    <div class="pk-intro" ref="pkIntroEl" role="status" aria-label="Penalty shootout transition">
      <i class="pi-sweep" ref="pkIntroSweepEl" aria-hidden="true"></i>
      <div class="pi-body" ref="pkIntroBodyEl">
        <div class="pi-kicker"><span>90′</span> FULL TIME · ALL SQUARE</div>
        <h2><span>THE DECIDING MOMENT</span>Penalty Shootout</h2>
        <div class="pi-matchup">
          <div class="pi-team home"><DuelCrest :label="homeIsMe ? GAME_MONOGRAM : homeName.slice(0,2).toUpperCase()" /><span class="pi-name"><i></i>{{ homeName }}</span></div>
          <div class="pi-tally"><div class="pi-score">{{ scoreHome }} <span>:</span> {{ scoreAway }}</div><span class="pi-level">AFTER 90 MINUTES</span></div>
          <div class="pi-team away"><DuelCrest :label="homeIsMe ? awayName.slice(0,2).toUpperCase() : GAME_MONOGRAM" /><span class="pi-name"><i></i>{{ awayName }}</span></div>
        </div>
        <div class="pi-visual" ref="pkIntroVisualEl" aria-hidden="true">
          <svg viewBox="0 0 200 72" fill="none"><defs><pattern id="pi-net" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M7 0H0V7" stroke="#bcd8e4" stroke-opacity=".2" stroke-width=".7"/></pattern></defs><path d="M34 49V6h132v43" stroke="#8daab9" stroke-width="1.5"/><path d="m34 6-10 10v41m142-51 10 10v41" stroke="#7f9da9" stroke-opacity=".5"/><path d="M24 57V16h152v41Z" fill="url(#pi-net)" stroke="#dcecf3" stroke-width="2"/><path d="M14 59h172M59 67h82" stroke="#7de9b4" stroke-opacity=".25"/></svg>
          <img :src="introFootball" width="640" height="640" alt="" />
        </div>
        <p>Decided from the spot.</p>
        <div class="pi-countdown"><span>FIRST KICK COMING UP</span><div class="pi-track" aria-hidden="true"><i ref="pkIntroProgressEl"></i></div></div>
      </div>
    </div>

    <!-- penalty showdown: the decisive kick leaves the pitch entirely and
         becomes shooter card vs keeper card (PRD §16.4) -->
    <div class="pk" ref="pkEl">
      <div class="pk-bg"></div>
      <div class="pk-vig" ref="pkVigEl"></div>
      <div class="pk-head" ref="pkHeadEl">
        {{ pkLabel }}<span class="pk-reg"> · {{ scoreHome }}:{{ scoreAway }} after 90'</span>
      </div>

      <!-- beat 1: the face-off, a tale of the tape -->
      <div class="pk-faceoff" ref="pkFaceEl">
        <div class="pk-slot" :class="pkSide">
          <div class="pk-slot-tag">{{ pkSide === 'home' ? homeName : awayName }}</div>
          <CardFace :card="pkShooterCard" size="md" full class="pk-card shooter" />
        </div>
        <div class="pk-vs">VS</div>
        <div class="pk-slot" :class="keepSide">
          <div class="pk-slot-tag">{{ keepSide === 'home' ? homeName : awayName }}</div>
          <CardFace :card="pkKeeperCard" size="md" full class="pk-card keeper" />
        </div>
      </div>

      <!-- beats 2-3: the penalty camera everyone can already read -->
      <div class="pk-goal" ref="pkGoalEl">
        <div class="pk-keeper-name" :class="keepSide">
          <i class="pk-jersey"></i>{{ pkKeeperCard && pkKeeperCard.name }}
        </div>
        <div class="pk-frame">
          <div class="pk-mesh"></div>
          <div class="pk-bar"></div>
          <div class="pk-post left"></div>
          <div class="pk-post right"></div>
          <div class="pk-ripple" ref="pkRippleEl"></div>
        </div>
        <div class="pk-gk" :class="keepSide" ref="pkGkEl"><PlayerArt :card-id="pkKeeperCard.id" kind="portrait" fill eager /></div>
        <div class="pk-spot"></div>
        <div class="pk-pball" ref="pkBallEl"></div>
        <div class="pk-shooter-name" :class="pkSide">
          <i class="pk-jersey"></i>{{ pkShooterCard && pkShooterCard.name }}
          <span class="pk-team">{{ pkSide === 'home' ? homeName : awayName }}</span>
        </div>
      </div>

      <div class="pk-board">
        <div v-for="side in ['HOME','AWAY']" :key="side" class="pk-row" :class="side.toLowerCase()">
          <span class="pk-team">{{ side === 'HOME' ? homeName : awayName }}</span>
          <span class="pk-pips">
            <i v-for="(k,i) in pkBoard[side]" :key="i" class="pk-pip" :class="k"></i>
          </span>
          <b class="pk-count">{{ pkCount(side) }}</b>
        </div>
      </div>
      <div class="pk-stamp" ref="pkStampEl">{{ pkStamp }}</div>
    </div>

    <!-- full time: the one place the whole result is stated, shootout included -->
    <div class="final" ref="finalEl">
      <div class="fi-bg" :class="winSide" ref="finalBgEl"></div>
      <div class="fi-body" ref="finalBodyEl">
        <div class="fi-emblem" aria-hidden="true"><svg viewBox="0 0 64 72" fill="none"><path d="M32 3 59 13v23c0 16-15 27-27 33C20 63 5 52 5 36V13L32 3Z" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="2"/><path d="m21 35 8 8 15-18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="fi-tag">FULL TIME</div>
        <div class="fi-score">
          <span class="fi-team home" :class="{ dim: winSide !== 'home' }">{{ homeName }}</span>
          <b ref="finalScoreEl">{{ scoreHome }} : {{ scoreAway }}</b>
          <span class="fi-team away" :class="{ dim: winSide !== 'away' }">{{ awayName }}</span>
        </div>
        <div v-if="pkScore" class="fi-pk">after penalties {{ pkScore }}</div>
        <div class="fi-win" :class="[winSide, winFit]" ref="finalWinEl">{{ winText }}</div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { GAME_MONOGRAM } from '../branding.js'
import { ref, reactive, computed, onMounted } from 'vue'
import PlayerArt from '../components/PlayerArt.vue'
import DuelCrest from '../components/DuelCrest.vue'
import introFootball from '../assets/kickoff-art/football.webp'
import CardFace from '../components/CardFace.vue'
import { SLOTS, basePos } from './stageModel.js'

const props = defineProps({
  home: { type: Object, required: true },      // team object from the engine
  away: { type: Object, required: true },
  homeName: { type: String, default: 'Home' },
  awayName: { type: String, default: 'Away' },
  homeIsMe: { type: Boolean, default: true }
})

const scoreHome = ref(0)
const scoreAway = ref(0)
const clockLabel = ref("0'")
const phaseLabel = ref('')
const cutCard = ref(null)
const cutText = ref('')
const cutSub = ref('')
const cutSide = ref('home')
const cutTeam = ref('')
const pkShooter = ref(null)
const pkKeeper = ref(null)
const pkLabel = ref('')
const pkStamp = ref('')
const pkBoard = ref({ HOME: [], AWAY: [] })
const pkScore = ref('')
const winSide = ref('home')
const winText = ref('')
const winFit = computed(() => winText.value.length > 18 ? 'xlong' : winText.value.length > 13 ? 'long' : '')
const pkSide = ref('home')                                   // who is taking it
const keepSide = computed(() => (pkSide.value === 'home' ? 'away' : 'home'))
/* the showdown cards stay mounted so the timeline compiler always has real
   elements to animate; setPk only swaps which card they show */
const pkShooterCard = computed(() => pkShooter.value || props.home.cards.fw)
const pkKeeperCard = computed(() => pkKeeper.value || props.away.cards.gk)
/* the running shootout score — counting green dots is not a thing anyone
   should have to do at 0.55s a kick */
function pkCount (side) { return (pkBoard.value[side] || []).filter(k => k === 'goal').length }

const pitchEl = ref(null)
const ballEl = ref(null)
const flashEl = ref(null)
const shockEl = ref(null)
const trailEl = ref(null)
const cutinEl = ref(null)
const ciBgEl = ref(null)
const ciBodyEl = ref(null)
const ciTextEl = ref(null)
const ciStreakEl = ref(null)
const ciTintEl = ref(null)
const ciCardEl = ref(null)
const scoreHomeEl = ref(null)
const scoreAwayEl = ref(null)
const pkEl = ref(null)
const pkIntroEl = ref(null)
const pkIntroBodyEl = ref(null)
const pkIntroProgressEl = ref(null)
const pkIntroVisualEl = ref(null), pkIntroSweepEl = ref(null)
const pkVigEl = ref(null)
const pkHeadEl = ref(null)
const pkFaceEl = ref(null)
const pkGoalEl = ref(null)
const pkGkEl = ref(null)
const finalEl = ref(null)
const finalBgEl = ref(null)
const finalBodyEl = ref(null)
const finalScoreEl = ref(null)
const finalWinEl = ref(null)
const pkRippleEl = ref(null)
const pkBallEl = ref(null)
const pkStampEl = ref(null)

const tokenEls = reactive({})
function setToken (key, el) { if (el) tokenEls[key] = el }

const tokenList = computed(() => {
  const out = []
  for (const side of ['home', 'away']) {
    const team = side === 'home' ? props.home : props.away
    for (const slot of SLOTS) {
      const card = team.cards[slot]
      const [x, y] = basePos(side, slot)
      out.push({ key: side + ':' + slot, side, slot, x, y, label: card.name.slice(0, 2).toUpperCase() })
    }
  }
  return out
})

/* The API the timeline compiler drives. Deliberately plain: player.js never
   touches Vue, it just gets elements and setters. */
const api = {
  token: (side, slot) => tokenEls[side + ':' + slot],
  tokens: (side) => SLOTS.map(s => tokenEls[side + ':' + s]).filter(Boolean),
  allTokens: () => Object.values(tokenEls),
  ball: () => ballEl.value,
  pitch: () => pitchEl.value,
  flash: () => flashEl.value,
  shock: () => shockEl.value,
  trail: () => trailEl.value,
  cutin: () => ({
    root: cutinEl.value, bg: ciBgEl.value, body: ciBodyEl.value,
    text: ciTextEl.value, streaks: ciStreakEl.value, tint: ciTintEl.value,
    card: ciCardEl.value
  }),
  scoreEl: (side) => (side === 'home' ? scoreHomeEl.value : scoreAwayEl.value),
  /* query the card elements rather than unwrapping component refs — CardFace
     is a <script setup> component and its ref proxy does not hand back $el
     reliably, while these nodes are always mounted */
  pk: () => {
    const root = pkEl.value
    return {
      root,
      bg: root && root.querySelector('.pk-bg'),
      vig: pkVigEl.value, head: pkHeadEl.value,
      faceoff: pkFaceEl.value, goal: pkGoalEl.value,
      shooter: root && root.querySelector('.pk-card.shooter'),
      keeper: root && root.querySelector('.pk-card.keeper'),
      gk: pkGkEl.value, ripple: pkRippleEl.value,
      shooterName: root && root.querySelector('.pk-shooter-name'),
      ball: pkBallEl.value, stamp: pkStampEl.value
    }
  },
  pkIntro: () => ({ root: pkIntroEl.value, body: pkIntroBodyEl.value, progress: pkIntroProgressEl.value, visual: pkIntroVisualEl.value, sweep: pkIntroSweepEl.value }),
  setPk: (shooter, keeper, label, board, side) => {
    pkShooter.value = shooter; pkKeeper.value = keeper
    pkLabel.value = label || ''
    if (board) pkBoard.value = board
    if (side) pkSide.value = side
  },
  setPkStamp: (t) => { pkStamp.value = t || '' },
  card: (side, slot) => (side === 'home' ? props.home : props.away).cards[slot],
  setScore: (h, a) => { scoreHome.value = h; scoreAway.value = a },
  setPkScore: (h, a) => { pkScore.value = (h === null ? '' : h + ':' + a) },
  final: () => ({
    root: finalEl.value, bg: finalBgEl.value, body: finalBodyEl.value,
    score: finalScoreEl.value, win: finalWinEl.value
  }),
  setFinal: (side, text) => { winSide.value = side; winText.value = text },
  setClock: (t) => { clockLabel.value = t },
  setPhase: (t) => { phaseLabel.value = t },
  setCutIn: (card, text, sub, side, team) => {
    cutCard.value = card; cutText.value = text || ''; cutSub.value = sub || ''
    if (side) cutSide.value = side
    cutTeam.value = team || ''
  },
  reset: () => {
    scoreHome.value = 0; scoreAway.value = 0
    clockLabel.value = "0'"; phaseLabel.value = ''
    cutCard.value = null; cutText.value = ''; cutSub.value = ''; cutTeam.value = ''
    pkScore.value = ''; winText.value = ''
    pkShooter.value = null; pkKeeper.value = null
    pkLabel.value = ''; pkStamp.value = ''
    pkBoard.value = { HOME: [], AWAY: [] }
  }
}

defineExpose({ api })
onMounted(() => { /* refs are live from here on */ })
</script>

<style scoped>
/* overlays are inset:0 on the stage and several of them scale or translate
   past it on the way in and out. Without this they paint over the feed. */
.stage { display: flex; flex-direction: column; position: relative; overflow: hidden; }

/* board and clock sit ABOVE the cut-in, so the score flip is visible while the
   scorer's card is on screen — the two beats are meant to land together */
.board, .clockbar { position: relative; z-index: 31; }
.board { display: flex; align-items: center; justify-content: space-between; background: var(--surface); padding: 9px 12px; gap: 8px; }
.side { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.side.right { justify-content: flex-end; }
.nm { font-size: 12px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.side.me .nm { color: var(--green); }
.jersey { width: 12px; height: 14px; border-radius: 2px; flex: 0 0 12px; }
.jersey.home { background: var(--home); }
.jersey.away { background: var(--away); }
.sc-wrap { display: flex; flex-direction: column; align-items: center; }
.sc { display: flex; align-items: baseline; gap: 5px; font-size: 25px; font-weight: 800; font-variant-numeric: tabular-nums; }
.sc span { font-size: 17px; color: var(--text-2); }
/* always present, empty in regular time: appearing mid-match used to grow
   the board by 11px and shove the pitch and the feed down with it */
.sc-pk { font-size: 9px; font-weight: 700; color: var(--r-l); letter-spacing: .06em; margin-top: -1px; line-height: 12px; min-height: 12px; }

.clockbar { display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--surface-lo); padding: 4px; }
.clk { font-size: 12px; font-weight: 700; color: var(--text-2); font-variant-numeric: tabular-nums; }
.phase { font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--r-l); }

.arena { position: relative; }
.pitch {
  position: relative; margin: 10px 12px; height: 186px;
  border-radius: 6px; overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.13), 0 4px 16px rgba(0,0,0,.45);
}
/* DARKER, not greener — and that is a legibility decision rather than a taste
   one. The tokens are painted ON this, so the brighter the grass the further
   they sink into it. Measured against the worst case (a token sitting on a
   bright mown stripe), home red scores 2.18:1 on the old top edge and 2.98:1
   on this one; under deuteranopia simulation, 2.67 against 3.62. Red on green
   is the classic colour-blind pair and this app has a red team on a green
   pitch, so the only axis that helps both normal and colour-blind vision is
   lightness. The pitch earns its looks from lighting, texture and line work. */
.turf {
  position: absolute; inset: 0;
  background:
    radial-gradient(130% 115% at 50% 42%,
      rgba(255,255,255,.085) 0%, rgba(255,255,255,.02) 42%, transparent 68%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 28px, transparent 28px 56px),
    radial-gradient(118% 108% at 50% 50%, transparent 52%, rgba(0,0,0,.42) 100%),
    linear-gradient(180deg, #1B3A24 0%, #163119 46%, #102517 100%);
}
.lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.lines g { fill: none; }
.l1 path, .l1 circle { stroke: rgba(255,255,255,.30); stroke-width: 1; }
.l2 path { stroke: rgba(255,255,255,.20); stroke-width: 1; }
.spot circle { fill: rgba(255,255,255,.34); stroke: none; }
.goal .mesh { fill: url(#netmesh); }
/* the same #EDEFF3 the shootout's bar and posts use, so regular time and the
   penalty camera are showing one goal rather than two different ones */
.goal .post { stroke: #EDEFF3; stroke-width: 2; fill: none; }

.trail { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.trail path { fill: none; stroke: rgba(255,255,255,.55); stroke-width: .5; stroke-linecap: round; vector-effect: non-scaling-stroke; }

.token {
  position: absolute; transform: translate(-50%,-50%);   /* GSAP takes this over via xPercent/yPercent */
  width: 23px; height: 23px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; font-weight: 800; color: #fff; letter-spacing: .02em;
  will-change: left, top, transform;
}
/* A pale rim, for the same reason the rarity ladder climbs more than hue: it
   is a channel that does not depend on telling red from blue. Against the
   darkened turf the rim reads about 14:1, so even where the two shirt colours
   collapse into each other you can still see that a piece is there.
   box-shadow rather than a border or a transform — a border would resize the
   box, and GSAP owns this element's transform (and its left/top). */
.token.home { background: radial-gradient(circle at 38% 32%, #FF4A57, var(--home) 62%); }
.token.away { background: radial-gradient(circle at 38% 32%, #5B9BF2, var(--away) 62%); }
.token.home, .token.away {
  box-shadow: 0 0 0 1.5px rgba(255,255,255,.55), 0 2px 6px rgba(0,0,0,.55);
}
.token.keeper {
  background: radial-gradient(circle at 38% 32%, #576070, #3B4150 62%);
  box-shadow: 0 0 0 1.5px rgba(255,255,255,.7), 0 2px 6px rgba(0,0,0,.55);
}
.token .ring {
  position: absolute; inset: -5px; border-radius: 50%;
  border: 2px solid var(--cta); box-shadow: 0 0 10px rgba(51,234,106,.55);
  opacity: 0; transform: scale(.7);
}

.ball {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%,-50%);
  width: 9px; height: 9px; border-radius: 50%;
  background: radial-gradient(circle at 36% 30%, #FFFFFF, #D8DEE8 70%);
  box-shadow: 0 0 9px rgba(255,255,255,.75), 0 1px 3px rgba(0,0,0,.6);
  will-change: left, top, transform;
}
.flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.shock {
  position: absolute; left: 50%; top: 50%; width: 24px; height: 24px; margin: -12px 0 0 -12px;
  border-radius: 50%; border: 2px solid #fff; opacity: 0; pointer-events: none;
}

/* ---------- full time ---------- */
.final { position: absolute; inset: 0; visibility: hidden; pointer-events: none; z-index: 34; }
/* fully opaque: full time owns the screen, nothing behind it should read */
.fi-bg { position: absolute; inset: 0; background: #07090D; }
.fi-bg.home {
  background:
    radial-gradient(ellipse at 50% 44%, rgba(228,24,39,.52), rgba(228,24,39,0) 66%),
    linear-gradient(180deg, #16080B 0%, #07090D 62%);
}
.fi-bg.away {
  background:
    radial-gradient(ellipse at 50% 44%, rgba(47,123,232,.48), rgba(47,123,232,0) 66%),
    linear-gradient(180deg, #080E1A 0%, #07090D 62%);
}
.fi-body { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; padding: 0 14px; }
.fi-tag { font-size: 10px; font-weight: 800; letter-spacing: .22em; color: var(--text-2); }
.fi-score { display: flex; align-items: center; gap: 12px; }
.fi-score b { font-size: 36px; font-weight: 800; font-variant-numeric: tabular-nums; }
.fi-team { font-size: 12px; font-weight: 700; width: 78px; }
.fi-team.home { text-align: right; color: #FF8A93; }
.fi-team.away { text-align: left; color: #8FC0FF; }
.fi-team.dim { opacity: .4; }
.fi-pk { font-size: 12px; font-weight: 700; color: var(--r-l); }
.fi-win {
  font-size: 30px; font-weight: 900; letter-spacing: .04em; margin-top: 4px;
  white-space: nowrap; text-shadow: 0 4px 24px rgba(0,0,0,.8);
}
/* long club names ran edge to edge at 30px */
.fi-win.long { font-size: 23px; }
.fi-win.xlong { font-size: 19px; }
.fi-win.home { color: #FF6B76; } .fi-win.away { color: #6FB0FF; }

/* ---------- penalty ---------- */
.pk { position: absolute; inset: 0; pointer-events: none; visibility: hidden; z-index: 32; }
.pk-bg { position: absolute; inset: 0; background: #0A0C10; }
.pk-vig {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at center, transparent 34%, rgba(0,0,0,.92) 80%);
}
.pk-head {
  position: absolute; top: 8px; left: 0; right: 0; text-align: center;
  font-size: 10px; font-weight: 800; letter-spacing: .16em; color: var(--text-2);
}

/* beat 1 — face-off */
.pk-faceoff {
  opacity: 0;
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between;
  padding: 0 18px;
}
.pk-slot { width: 106px; flex: 0 0 106px; display: flex; flex-direction: column; gap: 5px; }
.pk-slot-tag {
  font-size: 9px; font-weight: 800; letter-spacing: .06em; text-align: center;
  padding: 2px 0; border-radius: 3px;
}
.pk-slot.home .pk-slot-tag { background: rgba(228,24,39,.25); color: #FF8A93; }
.pk-slot.away .pk-slot-tag { background: rgba(47,123,232,.25); color: #8FC0FF; }
.pk-card { width: 106px; }
.pk-vs { font-size: 13px; font-weight: 900; color: var(--text-3); letter-spacing: .1em; }

/* beats 2-3 — the penalty camera */
.pk-goal { position: absolute; inset: 0; opacity: 0; }
.pk-keeper-name {
  position: absolute; top: 24px; left: 0; right: 0; text-align: center;
  font-size: 10px; font-weight: 700; letter-spacing: .06em;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.pk-keeper-name.home { color: #FF8A93; } .pk-keeper-name.away { color: #8FC0FF; }
.pk-jersey { width: 7px; height: 9px; border-radius: 2px; display: inline-block; }
.home > .pk-jersey { background: var(--home); } .away > .pk-jersey { background: var(--away); }
.pk-team { font-weight: 800; opacity: .75; margin-left: 2px; }
.pk-shooter-name {
  position: absolute; top: 62%; left: 0; right: 0;
  font-size: 11px; font-weight: 700; letter-spacing: .04em;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}
.pk-shooter-name.home { color: #FF8A93; } .pk-shooter-name.away { color: #8FC0FF; }
.pk-frame { position: absolute; left: 12%; right: 12%; top: 17%; height: 30%; }
.pk-mesh {
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,.13) 0 1px, transparent 1px 11px),
    repeating-linear-gradient(0deg, rgba(255,255,255,.13) 0 1px, transparent 1px 11px),
    linear-gradient(180deg, rgba(255,255,255,.05), transparent);
}
.pk-bar { position: absolute; left: -5px; right: -5px; top: -5px; height: 5px; background: #EDEFF3; border-radius: 2px; }
.pk-post { position: absolute; top: -5px; bottom: 0; width: 5px; background: #EDEFF3; border-radius: 2px; }
.pk-post.left { left: -5px; } .pk-post.right { right: -5px; }
.pk-ripple {
  position: absolute; width: 32px; height: 32px; margin: -16px 0 0 -16px;
  border-radius: 50%; border: 2px solid rgba(255,255,255,.75); opacity: 0;
}
.pk-gk {
  position: absolute; left: 50%; top: 35%;
  transform: translate(-50%,-50%);
  width: 30px; height: 30px; border-radius: 50%;
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 800;
  box-shadow: 0 2px 8px rgba(0,0,0,.5);
}
.pk-gk.home { background: var(--home); } .pk-gk.away { background: var(--away); }
.pk-spot {
  position: absolute; left: 50%; top: 56%; width: 5px; height: 5px; margin: -2px 0 0 -2px;
  border-radius: 50%; background: rgba(255,255,255,.4);
}
.pk-pball {
  position: absolute; left: 50%; top: 56%; z-index: 3;
  transform: translate(-50%,-50%);
  width: 13px; height: 13px; border-radius: 50%; background: #fff;
  box-shadow: 0 0 14px rgba(255,255,255,.8);
}

.pk-board {
  position: absolute; left: 0; right: 0; bottom: 8px;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.pk-reg { color: var(--text-3); font-weight: 700; }
.pk-row { display: flex; align-items: center; gap: 8px; width: 250px; }
.pk-team {
  font-size: 10px; font-weight: 700; width: 74px; flex: 0 0 74px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pk-row.home .pk-team { color: var(--home); }
.pk-row.away .pk-team { color: var(--away); }
.pk-pips { flex: 1; display: flex; gap: 4px; align-items: center; }
.pk-count {
  width: 18px; flex: 0 0 18px; text-align: right;
  font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums;
}
.pk-pip { width: 9px; height: 9px; border-radius: 50%; border: 1px solid var(--text-3); }
.pk-pip.goal { background: var(--cta); border-color: var(--cta); }
.pk-pip.miss { background: transparent; border-color: var(--red); position: relative; }
.pk-pip.miss::after {
  content: ''; position: absolute; inset: 1px; border-radius: 50%;
  background: linear-gradient(45deg, transparent 44%, var(--red) 44% 56%, transparent 56%);
}
.pk-stamp {
  position: absolute; left: 0; right: 0; top: 61%; text-align: center;
  font-size: 26px; font-weight: 900; letter-spacing: .05em; color: var(--cta);
  text-shadow: 0 3px 20px rgba(0,0,0,.9); opacity: 0;
}

.cutin { position: absolute; inset: 0; pointer-events: none; visibility: hidden; z-index: 30; }
.ci-bg { position: absolute; inset: 0; background: rgba(10,12,16,.82); opacity: 0; }
/* who scored has to be readable before the name is: the wash comes in from
   the side that attacked, in that side's jersey colour */
.ci-tint { position: absolute; inset: 0; opacity: 0; }
.ci-tint.home { background: linear-gradient(90deg, rgba(228,24,39,.55), rgba(228,24,39,.10) 48%, transparent 72%); }
.ci-tint.away { background: linear-gradient(270deg, rgba(47,123,232,.55), rgba(47,123,232,.10) 48%, transparent 72%); }
.ci-team {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 800; letter-spacing: .1em;
  padding: 3px 10px; border-radius: 999px;
}
.ci-team.home { background: rgba(228,24,39,.22); color: #FF8A93; }
.ci-team.away { background: rgba(47,123,232,.22); color: #8FC0FF; }
.ci-jersey { width: 8px; height: 10px; border-radius: 2px; }
.ci-team.home .ci-jersey { background: var(--home); }
.ci-team.away .ci-jersey { background: var(--away); }
.ci-streaks {
  position: absolute; inset: -20% -40%;
  background: repeating-linear-gradient(104deg, rgba(255,255,255,.07) 0 3px, transparent 3px 26px);
  opacity: 0;
}
/* padded so the column has somewhere to breathe, and so overflow shows up as
   overflow rather than as content touching the chrome */
.ci-body {
  position: absolute; inset: 0; padding: 8px 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
}
/* 66, down from 112, and the width is doing the work BECAUSE there is no
   height to spend. The cut-in is scoped to .arena (206px) rather than to the
   stage, on purpose — the board and clockbar sit above it at z-index 31 so
   the score flip is visible while the scorer's card is on screen. Measured,
   the overlay already uses 198.7 of those 206: card 91.7, gaps 18, team tag
   20.8, GOAL! 36, subtitle 16.2, padding 16. Seven pixels of slack.

   So the card keeps its height and narrows to reach 5:7 instead: 66 x 92.4
   against the old 112 x 91.7, which is 0.7px of growth. At 112 it would have
   been 156.8 tall and the subtitle fell 20.9px outside a stage that clips —
   the gate caught both cut-ins. Giving this moment a bigger card means taking
   the height from the GOAL! type or from the scoreboard's exemption, and
   those are somebody's decisions rather than a slot width. */
.ci-card-slot { width: 66px; flex: 0 0 auto; }
.ci-card { width: 100%; }
.ci-text {
  font-size: 36px; font-weight: 900; letter-spacing: .04em; line-height: 1;
  white-space: nowrap;
}
/* The word took the win colour and did not vary by side, so an opponent goal
   arrived as a blue wash, a blue team tag and a mint GOAL! — the same mistake
   the feed was making, one layer up. */
.ci-text.home { color: var(--home-hi); text-shadow: 0 3px 18px rgba(var(--home-rgb), .5); }
.ci-text.away { color: var(--away-hi); text-shadow: 0 3px 18px rgba(var(--away-rgb), .5); }
.ci-sub { font-size: 12px; font-weight: 700; color: #fff; }

/* Matchday broadcast treatment. Keep the scoreboard above animated cut-ins. */
.stage{flex:none;background:linear-gradient(180deg,#1e2a39,#0d1824);box-shadow:0 8px 24px #0003}.board{background:linear-gradient(135deg,#2b3949,#1b2634);padding:15px 18px 9px;border-bottom:1px solid #ffffff0b}.nm{font-size:12px}.side.me .nm{color:#fff}.team-id{display:flex;flex-direction:column;gap:2px;min-width:0}.team-id small{font-size:7px;font-weight:800;letter-spacing:.12em;color:#9fb3c8}.side.right .team-id{text-align:right}.sc{font-size:31px;gap:9px}.sc-pk{color:#e4cb8f}.jersey{box-shadow:0 1px 7px #0005;border:1px solid #ffffff30}.clockbar{background:#101c2a;padding:7px;min-height:30px}.clk{font-size:11px;color:#c4d1df}.arena{background:linear-gradient(180deg,#07111cb0,#09121dd9),url('../assets/shop-art/stadium.webp') center/cover}.pitch{height:226px;margin:14px 16px;border-radius:10px;box-shadow:0 0 0 1px #b8e3cd33,0 7px 28px #0008}.turf{background:radial-gradient(ellipse at 50% 30%,#ffffff0b,transparent 60%),repeating-linear-gradient(90deg,#ffffff08 0 32px,transparent 32px 64px),linear-gradient(180deg,#193d30,#0e2a20)}
.pk-bg{background:linear-gradient(180deg,#091421c9,#0a1521ed),url('../assets/shop-art/stadium.webp') center/cover}.pk-vig{background:radial-gradient(ellipse at center,transparent 40%,#0008)}.pk-head{top:10px;font-size:9px;letter-spacing:.1em;color:#d2deea}.pk-reg{color:#9dadbf}.pk-faceoff{padding:30px 30px 54px;gap:12px;justify-content:center}.pk-slot{width:106px;flex:0 0 106px;gap:8px}.pk-slot-tag{font-size:9px;padding:4px 5px;min-height:21px}.pk-card{width:106px}.pk-vs{font-size:14px;flex:none;width:27px;text-align:center;color:#d7c89e}.pk-board{bottom:11px;gap:5px}.pk-row{width:min(280px,85%);padding:2px 7px;background:#0a101bb3;border-radius:5px}.pk-row.home .pk-team{color:#ff9ca2}.pk-row.away .pk-team{color:#9bc5ff}.pk-pips{flex-wrap:wrap;gap:4px}.pk-pip{flex:none}.pk-count{font-size:16px}.pk-frame{top:17%;height:30%;filter:drop-shadow(0 8px 15px #0008)}.pk-keeper-name{top:44px;font-size:10px}.pk-gk{width:36px;height:36px;overflow:hidden;border:2px solid #eaf1f6cc;top:36%}.pk-gk :deep(.pa){width:100%;height:100%}.pk-shooter-name{top:65%;font-size:11px}.pk-stamp{top:66%;font-size:25px}.pk-spot,.pk-pball{top:56%}.pk-mesh{background:repeating-linear-gradient(90deg,#fff3 0 1px,transparent 1px 11px),repeating-linear-gradient(0deg,#fff3 0 1px,transparent 1px 11px),linear-gradient(180deg,#142e4266,#040c1488)}
.ci-bg{background:#0c1620e8}.ci-body{gap:5px}.ci-card-slot{width:84px}.ci-text{font-size:31px}.ci-team{font-size:10px}.ci-sub{font-size:11px}
.fi-bg.home{background:radial-gradient(ellipse at 50% 30%,#a82b3355,transparent 65%),linear-gradient(180deg,#101824d9,#080f19f2),url('../assets/shop-art/stadium.webp') center/cover}.fi-bg.away{background:radial-gradient(ellipse at 50% 30%,#285a9c55,transparent 65%),linear-gradient(180deg,#101824d9,#080f19f2),url('../assets/shop-art/stadium.webp') center/cover}.fi-body{gap:10px;padding:15px}.fi-emblem{width:50px;height:56px;color:#d9c083}.fi-emblem svg{width:100%;height:100%}.fi-tag{font-size:10px;letter-spacing:.23em}.fi-score{width:100%;justify-content:center;gap:12px}.fi-score b{font-size:39px;white-space:nowrap;flex:none}.fi-team{width:90px;min-width:0;overflow-wrap:anywhere;font-size:12px}.fi-win{font-size:27px;max-width:100%}.fi-pk{font-size:11px}
@media(max-width:350px){.board{padding:12px 12px 8px;gap:5px}.nm{font-size:10px}.side.me .nm::after{content:''}.sc{font-size:27px}.pitch{margin:12px;height:220px}.pk-faceoff{padding-left:12px;padding-right:12px;gap:8px}.pk-slot,.pk-card{width:96px}.pk-slot{flex-basis:96px}.ci-card-slot{width:76px}.fi-score{gap:7px}.fi-score b{font-size:32px}.fi-team{width:76px;font-size:10px}.fi-win{font-size:24px}}

/* The transition stays within the stage and on the protected intro clock. */
.pk-intro { position:absolute; inset:0; visibility:hidden; overflow:hidden; pointer-events:none; z-index:33; background:radial-gradient(ellipse at 50% 75%,#29786624,transparent 65%),linear-gradient(180deg,#071524e8,#081320bb 55%,#07121ff0),url('../assets/matchmaking-art/stadium.webp') center 60%/cover; }
.pi-sweep { position:absolute; inset:0; pointer-events:none; opacity:0; background:linear-gradient(115deg,transparent 40%,#d2f9e323 50%,transparent 60%); background-size:250% 100%; }
.pi-body { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:14px 22px; text-align:center; }
.pi-kicker { display:flex; align-items:center; gap:7px; color:#bed1df; font-size:8px; font-weight:800; letter-spacing:.12em; min-height:20px; }.pi-kicker > span { display:inline-flex; align-items:center; justify-content:center; min-width:27px; height:20px; border:1px solid #bba46688; border-radius:5px; background:#a5832f12; color:#f4db9e; font-size:9px; letter-spacing:0; }
.pi-body h2 { display:flex; flex-direction:column; gap:4px; font-size:30px; font-weight:900; line-height:1.05; letter-spacing:-.045em; color:#f3f9fd; text-shadow:0 2px 10px #0008; }.pi-body h2 > span { font-size:8px; font-weight:750; color:#dbbf7f; letter-spacing:.2em; line-height:1.2; }
.pi-matchup { display:grid; grid-template-columns:minmax(0,1fr) 108px minmax(0,1fr); align-items:center; gap:6px; width:100%; max-width:344px; padding:9px 12px; min-height:84px; border:1px solid #a3b9c64a; border-radius:13px; background:linear-gradient(125deg,#2b4151aa,#132636b0); box-shadow:inset 0 1px 0 #ffffff08; }
.pi-team { display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0; }.pi-team :deep(.duel-crest) { width:35px; }.pi-team :deep(b) { font-size:15px; }.pi-name { display:flex; align-items:center; justify-content:center; gap:4px; color:#e3edf5; font-size:10px; line-height:1.25; font-weight:700; overflow-wrap:anywhere; max-width:100%; }.pi-name i { width:5px; height:7px; flex:none; border-radius:1px; }.pi-team.home .pi-name i { background:var(--home); }.pi-team.away .pi-name i { background:var(--away); }
.pi-tally { display:flex; flex-direction:column; gap:5px; align-items:center; }.pi-score { font-size:34px; font-weight:900; line-height:1; font-variant-numeric:tabular-nums; color:#f4f9ff; white-space:nowrap; }.pi-score span { color:#8fa9bc; padding:0 5px; font-size:25px; }.pi-level { color:#b3c8d7; font-size:6px; letter-spacing:.08em; font-weight:700; }
.pi-visual { position:relative; width:180px; height:55px; flex:none; }.pi-visual svg { position:absolute; inset:0; width:100%; height:100%; filter:drop-shadow(0 1px 5px #89c7b91a); }.pi-visual img { position:absolute; left:calc(50% - 14px); bottom:-1px; width:28px; height:28px; object-fit:contain; filter:drop-shadow(0 5px 5px #0008); }
.pi-body p { margin:0; color:#c2d4e1; font-size:11px; line-height:1.4; }.pi-countdown { display:flex; flex-direction:column; align-items:center; gap:6px; }.pi-countdown > span { color:#8db9aa; font-size:7px; font-weight:750; letter-spacing:.14em; }.pi-track { width:124px; height:3px; background:#a0bcbd26; border-radius:99px; overflow:hidden; }.pi-track i { display:block; height:100%; background:linear-gradient(90deg,#49ce92,#a8f5cf); transform-origin:left; }
@media(max-width:350px) { .pi-body { padding:12px 14px; gap:7px; }.pi-body h2 { font-size:27px; }.pi-matchup { grid-template-columns:minmax(0,1fr) 90px minmax(0,1fr); padding:8px 10px; }.pi-name { font-size:9px; }.pi-score { font-size:31px; }.pi-visual { height:49px; }.pi-body p { font-size:10px; } }
</style>
