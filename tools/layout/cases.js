/* The screen/state matrix driven by `npm run layout`.

   Every case is a real store state reached through real game functions: the
   history rows, the match context and the settlement figures are all produced
   by src/game.js, never hand-written. A fixture for one history row would be
   ~80 lines of script and deck snapshot (see recordMatch) and would rot the
   moment the engine changed shape.

   `group` marks states that must be positionally IDENTICAL to each other.
   States with no group are only smoke-tested and geometry-checked; they are
   allowed to be different lengths. `scope` narrows a group's comparison to one
   region, for screens that agree down to a point and then deliberately differ. */

import { store, resetStore } from '../../src/store.js'
import * as game from '../../src/game.js'

/* The engine is deterministic given its rng, but the game layer reaches for
   Math.random (toss assignment, draw, script). Seeding it makes every case
   reproducible, which a gate needs more than it needs variety. */
function seeded (seed, fn) {
  const real = Math.random
  let s = seed >>> 0
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  try { return fn() } finally { Math.random = real }
}

/* ---------- store bases ---------- */

export function reset () {
  resetStore()
  game.abandonMatch()
  store.currentScreen = 'home'
}

/* a collection wide enough that DeckEdit has alternatives and Cards has both
   owned and locked slots */
function richCollection () {
  store.diamonds = 820
  store.cash = 40000
  store.tickets = 4
  store.ownedCards = {
    G1: { level: 3, shards: 0 }, G3: { level: 1, shards: 0 },
    F1: { level: 4, shards: 0 }, F2: { level: 2, shards: 0 },
    F3: { level: 2, shards: 0 }, F4: { level: 1, shards: 0 },
    F7: { level: 3, shards: 0 }, F11: { level: 2, shards: 0 },
    F12: { level: 0, shards: 1 }
  }
  store.deck = { gk: 'G1', fw: 'F1', mf: 'F2', df: 'F3' }
}

/* ---------- real match flow ---------- */

/* Runs the betting flow as the screens run it and stops at `upto`.
   wantPk picks the draw: forcePkScenario conditions on a regular-time tie. */
function flow (upto, { fee = 50, stake = null, wantPk = true, seed = 7 } = {}) {
  store.settings.forcePkScenario = wantPk
  store.pendingTier = fee
  return seeded(seed, () => {
    const found = game.startMatchmaking(fee)
    if (!found) throw new Error('no opponent for fee ' + fee)
    if (upto === 'matchmaking') return
    game.confirmBet(stake === null ? fee : stake)
    if (upto === 'confirm') return
    game.runToss()
    if (upto === 'toss' || upto === 'match') return
    game.finishMatch()
  })
}

/* A settled match in history. `wantPk` decides whether the row carries a
   "PK 2:3" tag, `wantWin` whether the detail page grows its fine-print line. */
function settledMatch ({ fee = 50, stake = 50, wantPk = true, wantWin = true, seed = 1 } = {}) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const before = store.history.length
    flow('result', { fee, stake, wantPk, seed: seed + attempt * 13 })
    const row = store.history[0]
    if (store.history.length > before && row.wentToPk === wantPk && row.won === wantWin) {
      game.abandonMatch()
      return row
    }
    if (store.history.length > before) store.history.shift()
    game.abandonMatch()
  }
  throw new Error(`could not draw a match with pk=${wantPk} won=${wantWin}`)
}

/* Walk the compiled timeline forward until the named cut-in is on screen and
   its entrance has landed, then leave it parked there to be measured. */
async function seekToCutIn (want, raf) {
  const tl = window.__match && window.__match.timeline
  if (!tl) throw new Error('match screen exposed no compiled timeline')
  tl.pause(0)
  const dur = tl.duration()
  let visibleSince = null
  for (let t = 0; t <= dur; t += 0.04) {
    tl.time(t, false)
    await raf()
    const ci = document.querySelector('.cutin')
    const txt = document.querySelector('.ci-text')
    const up = ci && getComputedStyle(ci).visibility === 'visible' && txt && txt.textContent === want
    if (!up) { visibleSince = null; continue }
    if (visibleSince === null) visibleSince = t
    // give the entrance tweens time to land before measuring
    if (t - visibleSince > 0.6) return
  }
  throw new Error(`no ${want} cut-in in this match`)
}

/* ---------- the matrix ---------- */

export const CASES = [
  /* ---- tab screens ---- */
  { id: 'home/fresh', screen: 'home', setup () { reset() } },
  { id: 'home/rich', screen: 'home', setup () { reset(); richCollection() } },

  { id: 'cards/grid', screen: 'cards', setup () { reset(); richCollection() } },

  { id: 'shop/fresh', screen: 'shop', setup () { reset() } },

  { id: 'tasks/fresh', screen: 'tasks', setup () { reset() } },

  { id: 'rank/fresh', screen: 'rank', setup () { reset() } },

  { id: 'history/empty', screen: 'history', setup () { reset() } },
  {
    id: 'history/rows',
    screen: 'history',
    setup () {
      reset(); richCollection()
      settledMatch({ wantPk: true, wantWin: true, seed: 3 })
      settledMatch({ wantPk: false, wantWin: false, seed: 5 })
    }
  },

  /* ---- flow screens ---- */
  {
    id: 'tierselect/fresh',
    screen: 'tierselect',
    setup () { reset() }
  },
  {
    id: 'matchmaking/searching',
    screen: 'matchmaking',
    setup () { reset(); richCollection(); store.pendingTier = 50 }
  },
  {
    id: 'confirm/open',
    screen: 'confirm',
    setup () { reset(); richCollection(); flow('confirm') }
  },
  {
    id: 'toss/open',
    screen: 'toss',
    setup () { reset(); richCollection(); flow('toss') }
  },
  {
    id: 'match/open',
    screen: 'match',
    setup () { reset(); richCollection(); flow('match') }
  },
  /* The overlays park at visibility:hidden between beats, so a sweep that only
     looks at a freshly mounted match screen never sees them at all. These two
     drive the real compiled timeline forward to the frame where each cut-in is
     up — forward only, never scrubbed backwards. */
  {
    id: 'match/goal-cutin',
    screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    act: ({ raf }) => seekToCutIn('GOAL!', raf)
  },
  {
    id: 'match/save-cutin',
    screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    act: ({ raf }) => seekToCutIn('SAVED', raf)
  },
  {
    id: 'result/win-pk',
    screen: 'result',
    setup () { reset(); richCollection(); flow('result', { wantPk: true }) }
  },

  /* ---- collection screens ---- */
  {
    id: 'deckedit/open',
    screen: 'deckedit',
    setup () { reset(); richCollection() }
  },
  {
    id: 'packopen/sealed',
    screen: 'packopen',
    setup () { reset(); richCollection(); store.pendingPack = 'standard' }
  },
  {
    id: 'upgrade/ready-in-squad',
    screen: 'upgrade',
    setup () {
      reset(); richCollection()
      store.ownedCards.F2 = { level: 2, shards: 99 }
      store.upgradeTarget = 'F2'
    }
  },
  {
    id: 'upgrade/ready-off-squad',
    screen: 'upgrade',
    setup () {
      reset(); richCollection()
      store.ownedCards.F4 = { level: 2, shards: 99 }
      store.upgradeTarget = 'F4'
    }
  },

  /* ---- dev screens: they ship in the build, so they are smoke-tested too ---- */
  { id: 'settings/open', screen: 'settings', setup () { reset() } },
  { id: 'motionlab/open', screen: 'motionlab', setup () { reset() } }
]
