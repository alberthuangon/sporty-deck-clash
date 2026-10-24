<template>
  <div class="stage">
    <!-- scoreboard -->
    <div class="board">
      <div class="side" :class="{ me: homeIsMe }">
        <i class="jersey home"></i>
        <span class="nm">{{ homeName }}</span>
      </div>
      <div class="sc">
        <b ref="scoreHomeEl">{{ scoreHome }}</b><span>:</span><b ref="scoreAwayEl">{{ scoreAway }}</b>
      </div>
      <div class="side right" :class="{ me: !homeIsMe }">
        <span class="nm">{{ awayName }}</span>
        <i class="jersey away"></i>
      </div>
    </div>
    <div class="clockbar">
      <span ref="clockEl" class="clk">{{ clockLabel }}</span>
      <span v-if="phaseLabel" class="phase">{{ phaseLabel }}</span>
    </div>

    <!-- pitch -->
    <div class="pitch" ref="pitchEl">
      <div class="turf"></div>
      <div class="line half"></div>
      <div class="circle"></div>
      <div class="box left"></div>
      <div class="box right"></div>
      <div class="six left"></div>
      <div class="six right"></div>
      <div class="net left"></div>
      <div class="net right"></div>

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
      <div class="ci-streaks" ref="ciStreakEl"></div>
      <div class="ci-body" ref="ciBodyEl">
        <CardFace v-if="cutCard" :card="cutCard" size="lg" class="ci-card" />
        <div class="ci-text" ref="ciTextEl">{{ cutText }}</div>
        <div class="ci-sub">{{ cutSub }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
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
const scoreHomeEl = ref(null)
const scoreAwayEl = ref(null)

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
    text: ciTextEl.value, streaks: ciStreakEl.value
  }),
  scoreEl: (side) => (side === 'home' ? scoreHomeEl.value : scoreAwayEl.value),
  card: (side, slot) => (side === 'home' ? props.home : props.away).cards[slot],
  setScore: (h, a) => { scoreHome.value = h; scoreAway.value = a },
  setClock: (t) => { clockLabel.value = t },
  setPhase: (t) => { phaseLabel.value = t },
  setCutIn: (card, text, sub) => { cutCard.value = card; cutText.value = text || ''; cutSub.value = sub || '' },
  reset: () => {
    scoreHome.value = 0; scoreAway.value = 0
    clockLabel.value = "0'"; phaseLabel.value = ''
    cutCard.value = null; cutText.value = ''; cutSub.value = ''
  }
}

defineExpose({ api })
onMounted(() => { /* refs are live from here on */ })
</script>

<style scoped>
.stage { display: flex; flex-direction: column; position: relative; }

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
.sc { display: flex; align-items: baseline; gap: 5px; font-size: 25px; font-weight: 800; font-variant-numeric: tabular-nums; }
.sc span { font-size: 17px; color: var(--text-2); }

.clockbar { display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--surface-lo); padding: 4px; }
.clk { font-size: 12px; font-weight: 700; color: var(--text-2); font-variant-numeric: tabular-nums; }
.phase { font-size: 10px; font-weight: 800; letter-spacing: .08em; color: var(--r-l); }

.pitch { position: relative; margin: 10px 12px; height: 186px; border-radius: 6px; overflow: hidden; }
.turf {
  position: absolute; inset: 0;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,.028) 0 28px, transparent 28px 56px),
    linear-gradient(180deg, #1F3D27, #16291A);
}
.line, .circle, .box, .six, .net { position: absolute; border-color: rgba(255,255,255,.20); }
.half { left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,.20); }
.circle { left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border: 1px solid rgba(255,255,255,.20); border-radius: 50%; }
.box { top: 50%; width: 52px; height: 104px; margin-top: -52px; border: 1px solid rgba(255,255,255,.20); }
.box.left { left: 0; border-left: 0; } .box.right { right: 0; border-right: 0; }
.six { top: 50%; width: 20px; height: 50px; margin-top: -25px; border: 1px solid rgba(255,255,255,.16); }
.six.left { left: 0; border-left: 0; } .six.right { right: 0; border-right: 0; }
.net { top: 50%; width: 6px; height: 34px; margin-top: -17px; background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.28); }
.net.left { left: 0; } .net.right { right: 0; }

.trail { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.trail path { fill: none; stroke: rgba(255,255,255,.55); stroke-width: .5; stroke-linecap: round; vector-effect: non-scaling-stroke; }

.token {
  position: absolute; transform: translate(-50%,-50%);   /* GSAP takes this over via xPercent/yPercent */
  width: 23px; height: 23px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 8px; font-weight: 800; color: #fff; letter-spacing: .02em;
  will-change: left, top, transform;
}
.token.home { background: var(--home); box-shadow: 0 1px 4px rgba(0,0,0,.45); }
.token.away { background: var(--away); box-shadow: 0 1px 4px rgba(0,0,0,.45); }
.token.keeper { background: #3B4150; border: 1.5px solid #fff3; }
.token .ring {
  position: absolute; inset: -5px; border-radius: 50%;
  border: 2px solid var(--cta); opacity: 0; transform: scale(.7);
}

.ball {
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%,-50%);
  width: 9px; height: 9px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 7px rgba(255,255,255,.6);
  will-change: left, top, transform;
}
.flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.shock {
  position: absolute; left: 50%; top: 50%; width: 24px; height: 24px; margin: -12px 0 0 -12px;
  border-radius: 50%; border: 2px solid #fff; opacity: 0; pointer-events: none;
}

.cutin { position: absolute; inset: 0; pointer-events: none; visibility: hidden; z-index: 30; }
.ci-bg { position: absolute; inset: 0; background: rgba(10,12,16,.82); opacity: 0; }
.ci-streaks {
  position: absolute; inset: -20% -40%;
  background: repeating-linear-gradient(104deg, rgba(255,255,255,.07) 0 3px, transparent 3px 26px);
  opacity: 0;
}
.ci-body {
  position: absolute; left: 0; right: 0; top: 62px; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
}
.ci-card { width: 122px; flex: 0 0 auto; }
.ci-text {
  font-size: 36px; font-weight: 900; letter-spacing: .04em; line-height: 1;
  color: var(--cta); text-shadow: 0 3px 18px rgba(51,234,106,.5); white-space: nowrap;
}
.ci-sub { font-size: 12px; font-weight: 700; color: #fff; }
</style>
