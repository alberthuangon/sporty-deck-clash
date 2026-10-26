/* Harness for `npm run layout`.
   Mounts the real match screen, runs a real compiled match, and samples the
   geometry every frame. The thing it is guarding against is a mid-match
   layout shift: the stage sits above the feed in a flex column, so anything
   that changes the stage's height mid-match drags the feed with it. */
import { createApp, h, ref, nextTick } from 'vue'
import Stage from '../../src/match/Stage.vue'
import '../../src/styles/tokens.css'
import '../../src/styles/base.css'
import { buildTeam, priceMatch, drawResult } from '../../src/engine/model.js'
import { buildScript } from '../../src/engine/scriptgen.js'
import { compileMatch, resetStage } from '../../src/match/player.js'
import cardData from '../../src/data/cards.json'

const gks = cardData.cards.filter(c => c.class === 'gk')
const out = cardData.cards.filter(c => c.class === 'outfield')
const deck = i => ({
  gk: { def: gks[i], level: 3 },
  fw: { def: out[i * 3], level: 3 },
  mf: { def: out[i * 3 + 1], level: 3 },
  df: { def: out[i * 3 + 2], level: 3 }
})
const home = buildTeam(deck(0), 'You')
const away = buildTeam(deck(1), 'KickMasterNG')

const stageRef = ref(null)
const feedRows = Array.from({ length: 8 }, (_, i) =>
  h('div', { class: 'ev' }, [
    h('span', { class: 'em' }, 'R' + i),
    h('span', { class: 'et' }, 'You — Adeyemi vs Obi: SAVED (sudden death)')
  ]))

const App = {
  setup: () => () => h('div', { class: 'phone' }, [
    h('div', { class: 'mt' }, [
      h(Stage, {
        ref: stageRef, home, away,
        homeName: 'You', awayName: 'KickMasterNG', homeIsMe: true
      }),
      h('div', { class: 'feed scroll', id: 'feed' }, feedRows),
      h('div', { class: 'ctrl' }, [h('button', { class: 'btn' }, 'Skip')])
    ])
  ])
}
createApp(App).mount('#app')

let compiled = null
window.__seek = t => compiled.timeline.progress(t / compiled.timeline.duration(), false)

window.__probe = async () => {
  await nextTick()
  let s = 42 >>> 0
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }

  const priced = priceMatch(home, away)
  // force the shootout: it is the half of the timeline that moves the most
  const res = drawResult(priced, true, rng, { forceDraw: true, minTieGoals: 1 })
  const script = buildScript(res, rng)
  const api = stageRef.value.api
  resetStage(api)
  compiled = compileMatch(api, script, res)
  compiled.timeline.pause(0)

  const stageEl = document.querySelector('.stage')
  const feedEl = document.querySelector('#feed')
  const dur = compiled.timeline.duration()
  const stageH = new Set()
  const feedTop = new Set()

  for (let t = 0; t <= dur; t += 1 / 60) {
    compiled.timeline.progress(t / dur, false)
    // the timeline's .call()s reach into Vue state, and Vue only patches the
    // DOM on a microtask - without yielding here the loop measures a DOM
    // that never changes, which is how the pens row slipped through
    await nextTick()
    stageH.add(+stageEl.getBoundingClientRect().height.toFixed(1))
    feedTop.add(+feedEl.getBoundingClientRect().top.toFixed(1))
  }

  return {
    duration: +dur.toFixed(2),
    stageHeights: [...stageH],
    feedTops: [...feedTop],
    stageClips: getComputedStyle(stageEl).overflow
  }
}
