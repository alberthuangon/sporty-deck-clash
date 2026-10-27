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

/* A settled match in history. The draw is a draw, so this redraws until it
   gets the shape the case needs — the alternative is hand-writing a history
   row, which means hand-writing a whole script and two deck snapshots.
   `reward` asks for a promotion that pays in diamonds or in tickets; the
   reward road gives tickets at Bronze II and diamonds at Bronze I
   (REWARD_ROAD, ladderIndex). */
function settledMatch ({ fee = 50, stake = 50, wantPk = true, wantWin = true, reward = null, seed = 1 } = {}) {
  if (reward === 'tickets') store.rank = { score: 49, tierIndex: 0, subtier: 3, peakNodes: [] }
  if (reward === 'diamonds') store.rank = { score: 49, tierIndex: 0, subtier: 2, peakNodes: [] }
  for (let attempt = 0; attempt < 400; attempt++) {
    const before = store.history.length
    flow('result', { fee, stake, wantPk, seed: seed + attempt * 13 })
    const row = store.history[0]
    const ok = store.history.length > before && row.wentToPk === wantPk && row.won === wantWin &&
      (!reward || row.promotions.some(p => p.reward[reward]))
    if (ok) { game.abandonMatch(); return row }
    if (store.history.length > before) store.history.shift()
    game.abandonMatch()
  }
  throw new Error(`could not draw a match with pk=${wantPk} won=${wantWin} reward=${reward}`)
}

/* Settle a match and STAY on the result screen, with the shape the case wants.
   finishMatch is single-shot, so this replays the flow until the draw lands
   the right way and only then leaves matchView standing. */
function resultLike ({ wantPk = true, wantWin = true, reward = null, seed = 11 } = {}) {
  if (reward === 'tickets') store.rank = { score: 49, tierIndex: 0, subtier: 3, peakNodes: [] }
  if (reward === 'diamonds') store.rank = { score: 49, tierIndex: 0, subtier: 2, peakNodes: [] }
  for (let attempt = 0; attempt < 400; attempt++) {
    const rankBefore = { ...store.rank }
    flow('result', { wantPk, seed: seed + attempt * 7 })
    const ok = game.matchView.wentToPk === wantPk && game.matchView.won === wantWin &&
      (!reward || game.matchView.promotions.some(p => p.reward[reward]))
    if (ok) return
    store.history.shift()
    store.rank = rankBefore
    game.abandonMatch()
  }
  throw new Error(`could not draw a result with pk=${wantPk} won=${wantWin} reward=${reward}`)
}

/* Drive the compiled timeline forward until `ready()` says the frame is the
   one to measure. Forward only — scrubbing a gsap timeline backwards is not
   the same as playing it. Feed rows can double up while seeking, because the
   callbacks that build the feed fire on every render; nothing measured here
   depends on the feed's length. */
async function seekUntil (ready, raf, what) {
  const tl = window.__match && window.__match.timeline
  if (!tl) throw new Error('match screen exposed no compiled timeline')
  tl.pause(0)
  let since = null
  for (let t = 0; t <= tl.duration(); t += 0.04) {
    tl.time(t, false)
    await raf()
    if (!ready()) { since = null; continue }
    if (since === null) since = t
    if (t - since > 0.6) return            // let the entrance tweens land
  }
  throw new Error(`never reached ${what} in this match`)
}

const overlayUp = (sel, text) => () => {
  const el = document.querySelector(sel)
  if (!el || getComputedStyle(el).visibility !== 'visible') return false
  if (!text) return true
  const t = document.querySelector('.ci-text')
  return t && t.textContent === text
}

/* ---------- the matrix ----------

   `group` marks states that must be positionally IDENTICAL. The rule for
   putting two states in one is not "they are both the Upgrade screen" — it is
   "a player sitting still on one screen can watch it turn into the other".
   Those are the transitions where a v-if that grows shoves something out from
   under a thumb. Two different outcomes rendered on two different visits are
   allowed to be different lengths, and are only smoke- and geometry-checked.

   `scope` narrows a group to the region that is promised to hold still, for
   screens that deliberately append below a point. */

export const CASES = [
  /* ------------------------------------------------ Home */
  { id: 'home/fresh', screen: 'home', setup () { reset() } },
  {
    id: 'home/with-history',
    screen: 'home',
    setup () { reset(); richCollection(); settledMatch({ seed: 3 }); settledMatch({ wantPk: false, wantWin: false, seed: 5 }) }
  },

  /* ------------------------------------------------ Cards */
  { id: 'cards/sparse', screen: 'cards', setup () { reset() } },
  {
    id: 'cards/full',
    screen: 'cards',
    group: 'cards-grid',
    setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 0 } }
  },
  {
    /* the only difference is a shard-full card, which lights a corner dot:
       absolutely positioned, so nothing may move */
    id: 'cards/full-upgradable',
    screen: 'cards',
    group: 'cards-grid',
    setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 99 } }
  },
  {
    id: 'cards/detail-owned',
    screen: 'cards',
    setup () { reset(); richCollection(); store.cardTarget = 'F1' }
  },
  {
    id: 'cards/detail-locked',
    screen: 'cards',
    setup () { reset(); richCollection(); store.cardTarget = 'F16' }
  },
  {
    id: 'cards/detail-upgradable',
    screen: 'cards',
    setup () { reset(); richCollection(); store.ownedCards.F1 = { level: 2, shards: 99 }; store.cardTarget = 'F1' }
  },

  /* ------------------------------------------------ Shop */
  { id: 'shop/affordable', screen: 'shop', group: 'shop-packs', setup () { reset(); store.diamonds = 900 } },
  {
    /* "Need N more" appears under the buy button in both pack cards */
    id: 'shop/too-poor',
    screen: 'shop',
    group: 'shop-packs',
    setup () { reset(); store.diamonds = 0 }
  },
  {
    id: 'shop/drop-rates',
    screen: 'shop',
    setup () { reset(); store.diamonds = 900 },
    act: ({ click }) => click('.odds-link')
  },

  /* ------------------------------------------------ Missions */
  { id: 'tasks/mixed', screen: 'tasks', group: 'tasks-claim', setup () { reset() } },
  {
    /* same screen, one tap later: Claim becomes Claimed */
    id: 'tasks/claimed',
    screen: 'tasks',
    group: 'tasks-claim',
    setup () { reset() },
    act: ({ click }) => click('.btn-cta.claim')
  },

  /* ------------------------------------------------ Rank */
  { id: 'rank/fresh', screen: 'rank', group: 'rank-road', setup () { reset() } },
  {
    /* claimed nodes only change colour and opacity */
    id: 'rank/claimed-nodes',
    screen: 'rank',
    group: 'rank-road',
    setup () { reset(); store.rank = { score: 20, tierIndex: 0, subtier: 2, peakNodes: ['b3', 'b2'] }; store.tickets = 5 }
  },

  /* ------------------------------------------------ History */
  { id: 'history/empty', screen: 'history', setup () { reset() } },
  {
    id: 'history/rows-pk',
    screen: 'history',
    group: 'history-rows',
    setup () {
      reset(); richCollection()
      settledMatch({ wantPk: true, wantWin: true, seed: 3 })
      settledMatch({ wantPk: true, wantWin: false, seed: 5 })
      settledMatch({ wantPk: true, wantWin: true, seed: 9 })
    }
  },
  {
    /* identical rows except that none of them carries a "PK 2:3" tag, which
       sits inline in a baseline flex row next to the score */
    id: 'history/rows-no-pk',
    screen: 'history',
    group: 'history-rows',
    setup () {
      reset(); richCollection()
      settledMatch({ wantPk: false, wantWin: true, seed: 3 })
      settledMatch({ wantPk: false, wantWin: false, seed: 5 })
      settledMatch({ wantPk: false, wantWin: true, seed: 9 })
    }
  },
  {
    id: 'history/detail-win',
    screen: 'history',
    setup () { reset(); richCollection(); settledMatch({ wantWin: true, seed: 3 }) },
    act: ({ click }) => click('.row')
  },
  {
    id: 'history/detail-loss',
    screen: 'history',
    setup () { reset(); richCollection(); settledMatch({ wantWin: false, seed: 5 }) },
    act: ({ click }) => click('.row')
  },
  {
    id: 'history/detail-reward-tickets',
    screen: 'history',
    setup () { reset(); richCollection(); settledMatch({ wantWin: true, reward: 'tickets', seed: 17 }) },
    act: ({ click }) => click('.row')
  },
  {
    id: 'history/detail-reward-diamonds',
    screen: 'history',
    setup () { reset(); richCollection(); settledMatch({ wantWin: true, reward: 'diamonds', seed: 23 }) },
    act: ({ click }) => click('.row')
  },

  /* ------------------------------------------------ Betting flow */
  { id: 'tierselect/locked', screen: 'tierselect', setup () { reset() } },
  { id: 'tierselect/unlocked', screen: 'tierselect', setup () { reset(); richCollection() } },
  {
    id: 'matchmaking/searching',
    screen: 'matchmaking',
    group: 'matchmaking-button',
    scope: '.mm > .btn',
    setup () { reset(); richCollection(); store.pendingTier = 50 }
  },
  {
    /* the log streams in underneath; the button below it must not walk away
       from the thumb reaching for it */
    id: 'matchmaking/found',
    screen: 'matchmaking',
    group: 'matchmaking-button',
    scope: '.mm > .btn',
    wait: 3400,
    setup () { reset(); richCollection(); store.pendingTier = 50 }
  },
  { id: 'confirm/open', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm') } },
  { id: 'confirm/no-match', screen: 'confirm', setup () { reset() } },
  {
    id: 'toss/spinning',
    screen: 'toss',
    group: 'toss-above-the-fold',
    scope: '.coin, .t-status, .locks',
    setup () { reset(); richCollection(); flow('toss') }
  },
  {
    /* same screen, 1.6s later: the result lands and prose appears BELOW the
       locks. The coin, the verdict line and the two price cells must not move */
    id: 'toss/landed',
    screen: 'toss',
    group: 'toss-above-the-fold',
    scope: '.coin, .t-status, .locks',
    wait: 2200,
    setup () { reset(); richCollection(); flow('toss') }
  },

  /* ------------------------------------------------ Match */
  { id: 'match/kickoff', screen: 'match', setup () { reset(); richCollection(); flow('match') } },
  {
    id: 'match/goal-cutin',
    screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    act: ({ raf }) => seekUntil(overlayUp('.cutin', 'GOAL!'), raf, 'the goal cut-in')
  },
  {
    id: 'match/save-cutin',
    screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    act: ({ raf }) => seekUntil(overlayUp('.cutin', 'SAVED'), raf, 'the save cut-in')
  },
  {
    id: 'match/penalties',
    screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    act: ({ raf }) => seekUntil(overlayUp('.pk'), raf, 'the shootout')
  },
  {
    id: 'match/full-time',
    screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    act: ({ raf }) => seekUntil(overlayUp('.final'), raf, 'the full-time card')
  },

  /* ------------------------------------------------ Result */
  { id: 'result/win-pk', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantPk: true, wantWin: true }) } },
  { id: 'result/lose-pk', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantPk: true, wantWin: false }) } },
  { id: 'result/win-no-pk', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantPk: false, wantWin: true }) } },
  { id: 'result/lose-no-pk', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantPk: false, wantWin: false }) } },
  { id: 'result/reward-tickets', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantWin: true, reward: 'tickets' }) } },
  { id: 'result/reward-diamonds', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantWin: true, reward: 'diamonds' }) } },

  /* ------------------------------------------------ Squad */
  { id: 'deckedit/open', screen: 'deckedit', setup () { reset(); richCollection() } },
  {
    id: 'deckedit/picking',
    screen: 'deckedit',
    setup () { reset(); richCollection() },
    act: ({ click }) => click('.slot', 1)
  },

  /* ------------------------------------------------ Pack opening */
  { id: 'packopen/sealed', screen: 'packopen', setup () { reset(); richCollection(); store.pendingPack = 'standard' } },
  {
    id: 'packopen/reveal-1',
    screen: 'packopen',
    group: 'packopen-reveal',
    setup () { reset(); richCollection(); store.pendingPack = 'standard' },
    act: ({ click }) => click('.btn-cta')
  },
  {
    id: 'packopen/reveal-3',
    screen: 'packopen',
    group: 'packopen-reveal',
    setup () { reset(); richCollection(); store.pendingPack = 'standard' },
    async act ({ click }) { await click('.btn-cta'); await click('.btn-cta'); await click('.btn-cta') }
  },
  {
    /* the fifth card is the same screen two taps later, and it grows a
       "final card" line ABOVE the card */
    id: 'packopen/reveal-last',
    screen: 'packopen',
    group: 'packopen-reveal',
    setup () { reset(); richCollection(); store.pendingPack = 'standard' },
    async act ({ click }) { for (let i = 0; i < 5; i++) await click('.btn-cta') }
  },
  {
    id: 'packopen/summary',
    screen: 'packopen',
    setup () { reset(); richCollection(); store.pendingPack = 'standard' },
    async act ({ click }) { for (let i = 0; i < 6; i++) await click('.btn-cta') }
  },

  /* ------------------------------------------------ Upgrade */
  { id: 'upgrade/no-card', screen: 'upgrade', setup () { reset() } },
  {
    id: 'upgrade/ready-in-squad',
    screen: 'upgrade',
    group: 'upgrade-axes',
    setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 99 }; store.upgradeTarget = 'F2' }
  },
  {
    /* an axis that gains nothing prints "· unchanged" where another prints
       "-> 66 +2": same slot, two very different lengths */
    id: 'upgrade/ready-off-squad',
    screen: 'upgrade',
    setup () { reset(); richCollection(); store.ownedCards.F4 = { level: 2, shards: 99 }; store.upgradeTarget = 'F4' }
  },
  {
    id: 'upgrade/short-of-shards',
    screen: 'upgrade',
    group: 'upgrade-axes',
    setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 0 }; store.upgradeTarget = 'F2' }
  },
  {
    id: 'upgrade/maxed',
    screen: 'upgrade',
    setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 10, shards: 0 }; store.upgradeTarget = 'F2' }
  },
  {
    id: 'upgrade/done',
    screen: 'upgrade',
    setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 99 }; store.upgradeTarget = 'F2' },
    act: ({ click }) => click('[data-sfx="upgrade"]')
  },

  /* ------------------------------------------------ dev screens, shipped */
  { id: 'settings/open', screen: 'settings', setup () { reset() } },
  { id: 'motionlab/open', screen: 'motionlab', setup () { reset() } }
]
