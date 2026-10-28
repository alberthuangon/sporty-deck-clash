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
import { uiRunning, uiLast, UI_TIME } from '../../src/ui/motion.js'
import { PACKS } from '../../src/engine/economy.js'

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

/* One owned card of every rarity, so Epic and Legendary actually reach the
   sweep. richCollection deliberately owns none of either (F12 is Epic but
   sits at level 0, which is not owned), which is why these need their own
   base rather than a tweak to that one. */
function ladderCollection () {
  store.diamonds = 820
  store.cash = 40000
  store.tickets = 4
  store.ownedCards = {
    G1: { level: 3, shards: 0 },      // C  neutral
    G3: { level: 2, shards: 0 },      // R  away
    G4: { level: 2, shards: 0 },      // E  home
    F13: { level: 1, shards: 0 },     // E  away
    F15: { level: 1, shards: 0 },     // L  home
    F16: { level: 2, shards: 0 }      // L  away
  }
  store.deck = { gk: 'G1', fw: 'F15', mf: 'F16', df: 'F13' }
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
function resultLike ({ wantPk = true, wantWin = true, reward = null, seed = 11, fee = 50, stake = null } = {}) {
  if (reward === 'tickets') store.rank = { score: 49, tierIndex: 0, subtier: 3, peakNodes: [] }
  if (reward === 'diamonds') store.rank = { score: 49, tierIndex: 0, subtier: 2, peakNodes: [] }
  for (let attempt = 0; attempt < 400; attempt++) {
    const rankBefore = { ...store.rank }
    flow('result', { wantPk, seed: seed + attempt * 7, fee, stake })
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
/* `hold` is how long the overlay must have been up before measuring, so the
   entrance tweens have landed. It has to clear the longest entrance (the goal
   cut-in's 0.42s card slide) and still be shorter than the shortest hold (the
   save cut-in is only 0.70s on screen). */
async function seekUntil (ready, raf, what, hold = 0.55) {
  const tl = timeline()
  tl.pause(0)
  let since = null
  for (let t = 0; t <= tl.duration(); t += 0.04) {
    tl.time(t, false)
    await raf()
    if (!ready()) { since = null; continue }
    if (since === null) since = t
    if (t - since > hold) return           // let the entrance tweens land
  }
  throw new Error(`never reached ${what} in this match`)
}

/* The full-time card is the terminal state — it has no exit, the match ends
   there and stays there (buildFinalWhistle). Measuring it anywhere earlier
   catches its entrance mid-flight: the winner line lands from scale 2.2, and
   at 2.2 a perfectly ordinary "IBADANBLAZE WIN" measures 727px wide inside a
   430px phone and reports itself as a layout bug that is not there. */
async function seekToEnd (raf) {
  const tl = timeline()
  tl.pause(0)
  const dur = tl.duration()
  for (let t = 0; t <= dur; t += 0.06) { tl.time(Math.min(t, dur), false); await raf() }
  tl.time(dur, false)
  await raf()
}

function timeline () {
  const tl = window.__match && window.__match.timeline
  if (!tl) throw new Error('match screen exposed no compiled timeline')
  return tl
}

/* Seek the payout roll to a named point. uiLast keeps the timeline alive
   after it lands, so this works whether or not the roll already finished —
   which is the only way to get a reproducible frame under virtual time.

   suppressEvents MUST be false. A count-up has no animated property on the
   element: the number only reaches the DOM through the tween's onUpdate, and
   gsap suppresses callbacks when you seek. Seeking with the default left all
   three payout states showing whatever natural playback had happened to
   leave behind — three cases that looked like they were measuring a frame
   each and were measuring the same accident. */
/* The first click on PackOpen now starts a 0.92s tear, and the card is not
   granted until it finishes. Every case that walks the reveal has to get
   through that door first; skipping it is what a second tap does anyway. */
/* Buy the pack the way the Shop does, because the Shop is where buying now
   happens: purchasePack pays, rolls and hands over all five in one act, and
   PackOpen performs a record of it. A case that only set pendingPack would
   land on a screen with nothing to show and bounce straight back to the shop
   — which is the correct behaviour and a useless state to measure. */
function boughtPack (id = 'standard') {
  store.pendingPack = id
  store.pendingPulls = game.purchasePack(PACKS.find(p => p.id === id))
}

async function openPack (click, raf) {
  await click('[data-sfx="tear"]')
  const run = uiLast('tear')
  if (!run) throw new Error('the pack did not tear')
  run.skip()
  await raf()
  await raf()
}

/* Catch a flight in mid-air. It has to be paused IMMEDIATELY after the click
   that starts it: the tokens remove themselves when they land, and a frame
   that has already been cleaned up cannot be seeked back to — unlike the
   payout roll, whose timeline survives its own end. */
function holdFlight (at) {
  const run = uiLast('flyIn')
  if (!run) throw new Error('nothing flew')
  if (run.record.done) throw new Error('the flight landed before it could be held')
  run.timeline.pause(at === null ? 0.25 : at)
}

function seekPayout (progress) {
  const run = uiLast('payout')
  if (!run) throw new Error('the payout figure did not roll')
  run.timeline.pause()          // or settle()'s own frames play it forward again
  run.timeline.progress(Math.max(0, Math.min(1, progress)), false)
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
  { id: 'home/arena-selected', screen: 'home', setup () { reset() }, act () { document.querySelector('.arena:not(:disabled)').click() } },
  { id: 'home/arenas-unlocked', screen: 'home', setup () { reset(); store.rank = { score: 0, tierIndex: 1, subtier: 3, peakNodes: ['b3', 'b2', 'b1'] }; store.pendingTier = 200 } },
  { id: 'home/large-jackpot', screen: 'home', setup () { reset(); store.jackpot.pool = 999999999; store.tickets = 48310 } },
  {
    id: 'home/with-history',
    screen: 'home',
    setup () { reset(); richCollection(); settledMatch({ seed: 3 }); settledMatch({ wantPk: false, wantWin: false, seed: 5 }) }
  },

  {
    /* sealed: a draw is waiting and the card is an invitation to open it */
    id: 'home/draw-sealed',
    screen: 'home',
    group: 'jackpot-card',
    setup () { reset(); richCollection(); store.tickets = 2 }
  },
  {
    /* opened: the same card, now a record of what happened. Nothing on it may
       move between the two — the line changes, the card does not. */
    id: 'home/after-draw',
    group: 'jackpot-card',
    screen: 'home',
    setup () {
      reset(); richCollection(); store.tickets = 2
      game.runSeasonDraw(false)
      store.flags.seenDraw = store.jackpot.lastDraw.season
      store.overlay = null
    }
  },

  /* ------------------------------------------------ Jackpot draw takeover

     PRD §6.7.2 says winning and losing share one template and differ only in
     the headline and the celebration. That is exactly an invariance group:
     every element the two states have in common has to sit at the same
     height, which is what makes "mirror design" a fact rather than a claim.
     Scoped to the takeover because it lives outside .screen. */
  {
    id: 'draw/lost',
    screen: 'home',
    group: 'draw-mirror',
    scope: '.dr',
    wait: 2600,
    setup () { reset(); richCollection(); store.tickets = 2; game.runSeasonDraw(false); store.overlay = 'draw' }
  },
  {
    id: 'draw/won',
    screen: 'home',
    group: 'draw-mirror',
    scope: '.dr',
    wait: 2600,
    setup () { reset(); richCollection(); store.tickets = 2; game.runSeasonDraw(true); store.overlay = 'draw' }
  },
  {
    /* nobody holds a ticket in their first season: the odds row has to say
       something, and "1 in Infinity" is not it (§6.7.3 edge, PRD v0.26) */
    id: 'draw/no-tickets',
    screen: 'home',
    wait: 1800,
    setup () { reset(); richCollection(); store.tickets = 0; game.runSeasonDraw(false); store.overlay = 'draw' }
  },

  /* ------------------------------------------------ Rank-up takeover
     (step 6 item 1, the promotion burst)

     Three states, for three different questions. The first photographs the
     burst mid-flight, which is the only way to see whether it is animating
     anything at all — this repo has shipped three animations pointed at
     elements that did not exist, and every one of them read fine in the
     source. The other two are an invariance group, which is how "a skip lands
     on the END state" becomes a fact: interrupt it at 0.3s and finish it
     normally, and the two have to measure identical. */
  {
    id: 'rankup/burst',
    screen: 'home',
    scope: '.ru',
    setup () {
      reset(); richCollection()
      store.rankUpView = { label: 'Bronze II', reward: { tickets: 2 } }
      store.overlay = 'rankup'
    },
    async act ({ raf, at }) {
      const run = uiRunning()
      if (!run) throw new Error('the rank-up takeover played nothing')
      run.timeline.pause(at === null ? 0.3 : at)   // a frame, not a settled state
      await raf()
    }
  },
  {
    id: 'rankup/settled',
    screen: 'home',
    group: 'rankup-end',
    scope: '.ru',
    wait: 2600,
    setup () {
      reset(); richCollection()
      store.rankUpView = { label: 'Bronze I', reward: { diamonds: 50 } }
      store.overlay = 'rankup'
    }
  },
  {
    /* interrupted at 0.3s of 1.22s. Paused first, so the click is exercised
       for real rather than racing the animation to the finish line. */
    id: 'rankup/skipped',
    screen: 'home',
    group: 'rankup-end',
    scope: '.ru',
    setup () {
      reset(); richCollection()
      store.rankUpView = { label: 'Bronze I', reward: { diamonds: 50 } }
      store.overlay = 'rankup'
    },
    async act ({ click, raf }) {
      const run = uiRunning()
      if (!run) throw new Error('the rank-up takeover played nothing to interrupt')
      run.timeline.pause(0.3)
      await raf()
      await click('[data-skip="rankUp"]')
    }
  },

  {
    /* the reward chips leaving the takeover as it closes. The tokens outlive
       their own source on purpose — the overlay is already unmounting. */
    id: 'rankup/reward-flying',
    screen: 'home',
    setup () {
      reset(); richCollection()
      store.rankUpView = { label: 'Bronze I', reward: { diamonds: 50 } }
      store.overlay = 'rankup'
    },
    async act ({ click, raf, at }) {
      await click('.ru-go')
      holdFlight(at)
      await raf()
    }
  },
  {
    /* The other reward the road pays. It matters on its own because the two
       rewards take different routes — diamonds to the wallet chip in the top
       bar, tickets to the Rank tab, since there is no ticket chip up there —
       and because the ticket in flight is the one token built outside Vue, so
       nothing in a template was ever going to prove it renders. */
    id: 'rankup/ticket-flying',
    screen: 'home',
    setup () {
      reset(); richCollection()
      store.rankUpView = { label: 'Bronze II', reward: { tickets: 3 } }
      store.overlay = 'rankup'
    },
    async act ({ click, raf, at }) {
      await click('.ru-go')
      holdFlight(at)
      await raf()
    }
  },

  /* ------------------------------------------------ Cards */
  { id: 'cards/sparse', screen: 'cards', setup () { reset() } },
  { id: 'cards/filter-owned', screen: 'cards', setup () { reset() }, async act ({ click }) {
    await click('[data-filter="owned"]')
    if (document.querySelectorAll('.grid .slot').length !== 4 || document.querySelector('.grid .cf.locked')) throw new Error('Owned filter must show exactly the four owned cards')
  } },
  { id: 'cards/filter-uncollected', screen: 'cards', setup () { reset() }, async act ({ click }) {
    await click('[data-filter="uncollected"]')
    if (document.querySelectorAll('.grid .slot').length !== 16 || document.querySelectorAll('.grid .cf.locked').length !== 16) throw new Error('Uncollected filter must show sixteen locked cards')
  } },
  { id: 'cards/filter-empty', screen: 'cards', setup () { reset() }, async act ({ click, nextTick }) {
    await click('[data-filter="owned"]')
    const select = document.querySelector('[aria-label="Filter by rarity"]')
    select.value = 'L'; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick()
    if (!document.querySelector('.collection-empty') || document.querySelector('.grid')) throw new Error('Owned Legendary filter must show the empty state')
  } },
  { id: 'cards/filter-reset', screen: 'cards', setup () { reset() }, async act ({ click, nextTick }) {
    await click('[data-filter="owned"]')
    const select = document.querySelector('[aria-label="Filter by rarity"]')
    select.value = 'L'; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick()
    await click('.collection-empty .btn')
    if (document.querySelectorAll('.grid .slot').length !== 20) throw new Error('Reset must restore all twenty cards')
  } },
  { id: 'cards/sort-rarity', screen: 'cards', setup () { reset() }, async act ({ nextTick }) {
    const select = document.querySelector('[aria-label="Sort cards"]')
    select.value = 'rarity'; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick()
    const cards = [...document.querySelectorAll('.grid .cf-rar')].map(el => el.textContent.trim())
    const order = { L: 3, E: 2, R: 1, C: 0 }
    if (cards.length !== 20 || cards.some((r, i) => i > 0 && order[r] > order[cards[i - 1]])) throw new Error('Rarity sort must run from Legendary to Common')
  } },
  { id: 'cards/filter-back', screen: 'cards', setup () { reset() }, async act ({ click }) {
    await click('[data-filter="owned"]'); await click('.card-open'); await click('.tb-back')
    if (document.querySelectorAll('.grid .slot').length !== 4 || document.querySelector('[data-filter="owned"]').getAttribute('aria-pressed') !== 'true') throw new Error('Back must preserve the owned filter')
  } },
  { id: 'cards/sort-level', screen: 'cards', setup () { reset(); richCollection() }, async act ({ nextTick }) {
    const select = document.querySelector('[aria-label="Sort cards"]')
    select.value = 'level'; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick()
    const levels = [...document.querySelectorAll('.grid .cf-lv')].map(el => Number(el.textContent.replace('Lv.', '')))
    if (levels[0] !== 4 || levels.some((n, i) => i > 0 && n > levels[i - 1])) throw new Error('Level sort must put the highest owned levels first')
  } },
  { id: 'cards/sort-name', screen: 'cards', setup () { reset() }, async act ({ nextTick }) {
    const select = document.querySelector('[aria-label="Sort cards"]')
    select.value = 'name'; select.dispatchEvent(new Event('change', { bubbles: true })); await nextTick()
    const names = [...document.querySelectorAll('.grid .cf-name')].map(el => el.textContent.trim())
    if (names[0] !== 'Adeyemi' || names[names.length - 1] !== 'Zuberi') throw new Error('Alphabetical sort must run from Adeyemi to Zuberi')
  } },
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
  /* ---- the rarity ladder ----

     Epic and Legendary were all but invisible to this sweep. Measured across
     the 74 states: C appeared in 37, R in 6, E in 9, and L in exactly ONE
     (cards/detail-locked). So the two steps the card face spends most of its
     colour on had almost nothing asserting they fit, and L's foil layer had a
     single state looking at it.

     The group is the real claim: a card's geometry may not depend on its
     rarity. That is not a style preference — packopen-reveal already compares
     four states showing four different cards, so a rarity that costs a pixel
     of height walks every row under it. Here it is asserted head-on, one card
     of each rarity in the same place, with the venues deliberately mixed
     (neutral / away / home / away) so the jersey swatch is pinned too. */
  { id: 'cards/rarity-C', screen: 'cards', group: 'rarity-ladder', scope: '.hero',
    setup () { reset(); ladderCollection(); store.cardTarget = 'G1' } },
  { id: 'cards/rarity-R', screen: 'cards', group: 'rarity-ladder', scope: '.hero',
    setup () { reset(); ladderCollection(); store.cardTarget = 'G3' } },
  { id: 'cards/rarity-E', screen: 'cards', group: 'rarity-ladder', scope: '.hero',
    setup () { reset(); ladderCollection(); store.cardTarget = 'G4' } },
  { id: 'cards/rarity-L', screen: 'cards', group: 'rarity-ladder', scope: '.hero',
    setup () { reset(); ladderCollection(); store.cardTarget = 'F16' } },
  {
    /* the same four at sm, in the grid, where the radar and the hatch are
       drawn into a 130x104 cell rather than a 150px hero */
    id: 'cards/all-rarities',
    screen: 'cards',
    setup () { reset(); ladderCollection() }
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

  {
    /* mid-flight, in the same group as the two states above: the diamonds
       crossing the screen may not move the mission card they came from */
    id: 'tasks/claim-flying',
    screen: 'tasks',
    group: 'tasks-claim',
    setup () { reset() },
    async act ({ click, raf, at }) {
      await click('.btn-cta.claim')
      holdFlight(at)
      await raf()
    }
  },

  /* ------------------------------------------------ Rank */
  { id: 'rank/fresh', screen: 'rank', group: 'rank-road', setup () { reset() } },
  {
    /* Reward status and the next-reward preview must keep the road stable. */
    id: 'rank/claimed-nodes',
    screen: 'rank',
    group: 'rank-road',
    setup () { reset(); store.rank = { score: 20, tierIndex: 0, subtier: 2, peakNodes: ['b3', 'b2'] }; store.tickets = 5 }
  },

  { id: 'rank/rules-open', screen: 'rank', setup () { reset() }, act () { document.querySelector('.rank-help summary').click() } },
  { id: 'rank/major-promotion', screen: 'rank', setup () { reset(); store.rank = { score: 49, tierIndex: 0, subtier: 1, peakNodes: ['b3', 'b2'] } } },
  { id: 'rank/demoted-after-rewards', screen: 'rank', setup () { reset(); store.rank = { score: 10, tierIndex: 0, subtier: 3, peakNodes: ['b3', 'b2'] } } },
  { id: 'rank/champion', screen: 'rank', setup () { reset(); store.rank = { score: 1320, tierIndex: 5, subtier: 3, peakNodes: ['b3', 'b2', 'b1', 's3', 's2', 's1', 'g3', 'g2'] } } },

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
    act: ({ raf }) => seekToEnd(raf)
  },

  /* ------------------------------------------------ Result */
  { id: 'result/win-pk', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantPk: true, wantWin: true }) } },
  { id: 'result/lose-pk', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantPk: true, wantWin: false }) } },
  { id: 'result/win-no-pk', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantPk: false, wantWin: true }) } },
  { id: 'result/lose-no-pk', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantPk: false, wantWin: false }) } },
  { id: 'result/reward-tickets', screen: 'result', setup () { reset(); richCollection(); resultLike({ wantWin: true, reward: 'tickets' }) } },
  /* The payout roll (step 6 item 2). A figure that grows from ₦50 to ₦2,850,182
     is a figure whose width changes under the reader, and the ledger around it
     is not allowed to move — so the money card mid-roll and the money card at
     rest go in one invariance group. Both cases SEEK the timeline rather than
     waiting for it: uiLast() keeps the timeline alive after it lands, and
     naming the frame is the only reliable way to get one under virtual time. */
  /* The top arena at a ₦799 stake on purpose: these three states are the only
     place in the sweep where the payout figure changes WIDTH as it rolls, and
     a group that compares ₦50 turning into ₦77 would pass for free. */
  {
    /* frame zero. §2.1 says the roll may not make the player wait to read the
       answer, so it starts at the stake — the magnitude is right immediately.
       run.mjs compares the digits here against the digits at rest. */
    id: 'result/payout-start',
    screen: 'result',
    group: 'payout-figure',
    scope: '.money',
    setup () { reset(); richCollection(); resultLike({ wantWin: true, fee: 200, stake: 799 }) },
    async act ({ raf }) { seekPayout(0); await raf() }
  },
  {
    id: 'result/payout-rolling',
    screen: 'result',
    group: 'payout-figure',
    scope: '.money',
    setup () { reset(); richCollection(); resultLike({ wantWin: true, fee: 200, stake: 799 }) },
    async act ({ raf, at }) { seekPayout(at === null ? 0.5 : at / UI_TIME.payout); await raf() }
  },
  {
    id: 'result/payout-settled',
    screen: 'result',
    group: 'payout-figure',
    scope: '.money',
    setup () { reset(); richCollection(); resultLike({ wantWin: true, fee: 200, stake: 799 }) },
    async act ({ raf }) { seekPayout(1); await raf() }
  },
  {
    /* the promotion block is the door into the rank-up takeover, and it is a
       button now — so it has to be tappable at 44px and open what it says */
    id: 'result/promo-opened',
    screen: 'result',
    setup () { reset(); richCollection(); resultLike({ wantWin: true, reward: 'tickets' }) },
    act: ({ click }) => click('[data-sfx="rankup"]')
  },
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
  {
    id: 'packopen/sealed',
    screen: 'packopen',
    group: 'packopen-tear',
    scope: '.po > .stage > .btn',
    setup () { reset(); richCollection(); boughtPack() }
  },
  {
    /* The gold pack at full size had nothing looking at it: every packopen
       case pins pendingPack to 'standard', so the dearer of the two products
       only ever appeared as a 104px shop thumbnail. Same shape as Legendary
       turning out to have one state — the tier the art spends most on is the
       tier the sweep sees least. Not in the tear group: it is the same
       geometry, and a second pack in that group would compare a pack with
       itself rather than a sealed pack with a tearing one. */
    id: 'packopen/sealed-gold',
    screen: 'packopen',
    setup () { reset(); richCollection(); store.diamonds = 900; boughtPack('gold') }
  },
  {
    /* mid-rip. The halves are supposed to move, so the group is scoped to the
       button underneath them: the thing a thumb is already reaching for must
       not walk away while the pack opens.
       expectAbsent is the other half of the claim — a pack that shows you the
       card while it is still tearing was never sealed. */
    id: 'packopen/tearing',
    screen: 'packopen',
    group: 'packopen-tear',
    scope: '.po > .stage > .btn',
    expectAbsent: '.reveal-card',
    setup () { reset(); richCollection(); boughtPack() },
    async act ({ click, raf, at }) {
      await click('[data-sfx="tear"]')
      const run = uiLast('tear')
      if (!run) throw new Error('the pack did not tear')
      run.timeline.pause(at === null ? 0.45 : at)
      await raf()
    }
  },
  {
    id: 'packopen/reveal-1',
    screen: 'packopen',
    group: 'packopen-reveal',
    setup () { reset(); richCollection(); boughtPack() },
    act: ({ click, raf }) => openPack(click, raf)
  },
  {
    /* the first card is a duplicate, so a shard is on its way to the count
       below it. Same group: a shard in the air may not move the card. */
    id: 'packopen/shard-flying',
    screen: 'packopen',
    group: 'packopen-reveal',
    setup () { reset(); richCollection(); boughtPack() },
    async act ({ click, raf, at }) {
      await openPack(click, raf)
      holdFlight(at)
      await raf()
    }
  },
  {
    id: 'packopen/reveal-3',
    screen: 'packopen',
    group: 'packopen-reveal',
    setup () { reset(); richCollection(); boughtPack() },
    async act ({ click, raf }) { await openPack(click, raf); await click('.btn-cta'); await click('.btn-cta') }
  },
  {
    /* the fifth card is the same screen two taps later, and it grows a
       "final card" line ABOVE the card */
    id: 'packopen/reveal-last',
    screen: 'packopen',
    group: 'packopen-reveal',
    setup () { reset(); richCollection(); boughtPack() },
    async act ({ click, raf }) { await openPack(click, raf); for (let i = 0; i < 4; i++) await click('.btn-cta') }
  },
  {
    id: 'packopen/summary',
    screen: 'packopen',
    setup () { reset(); richCollection(); boughtPack() },
    async act ({ click, raf }) { await openPack(click, raf); for (let i = 0; i < 5; i++) await click('.btn-cta') }
  },
  {
    /* one of the five, looked at full size. The summary's cards are 5:7 now
       and a tap opens the same lg + foil + sway card the collection's detail
       page shows, so this is the second place in the app where that object
       appears at full size — and the first one that reaches it by tapping a
       grid rather than by navigating. */
    id: 'packopen/card-view',
    screen: 'packopen',
    setup () { reset(); richCollection(); boughtPack() },
    async act ({ click, raf }) {
      await openPack(click, raf)
      for (let i = 0; i < 5; i++) await click('.btn-cta')
      await click('.sum-slot')
      await raf()
    }
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
    /* an axis that gains nothing. It used to print "· unchanged" against a
       neighbour's "-> 66 +2" — two very different lengths in one slot — and
       now prints a muted +0 against a mint +2 on the chart itself. Same job:
       this is the state that proves "no gain" still SAYS something after the
       stat table was folded into the radar. */
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
    group: 'upgrade-after',
    setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 99 }; store.upgradeTarget = 'F2' },
    act: ({ click }) => click('[data-sfx="upgrade"]')
  },
  {
    /* the same screen with the radar half-way through its morph. Grouped with
       the settled state because that IS the claim §2.1 makes here: the new
       numbers are already on screen and nothing around the chart moves while
       the shape catches up. The polygon's own vertices are not compared —
       measure.js leaves SVG internals out, since a radar's points are the
       card's stats rather than layout. */
    id: 'upgrade/radar-morphing',
    screen: 'upgrade',
    group: 'upgrade-after',
    setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 99 }; store.upgradeTarget = 'F2' },
    async act ({ click, raf, at }) {
      await click('[data-sfx="upgrade"]')
      const run = uiLast('radar')
      if (!run) throw new Error('the radar did not morph')
      run.timeline.pause()
      /* suppressEvents false: the shape reaches the DOM through onUpdate,
         exactly like the payout figure */
      run.timeline.progress(at === null ? 0.45 : at / UI_TIME.radar, false)
      await raf()
    }
  },

  /* ------------------------------------------------ dev screens, shipped */
  { id: 'settings/open', screen: 'settings', setup () { reset() } },
  { id: 'motionlab/open', screen: 'motionlab', group: 'motionlab-preview', scope: '.ctrl', setup () { reset() } },
  {
    /* the lab is the hand-off: its sliders are how the rhythm gets retuned
       without a rebuild, so at least one of its Play buttons is exercised
       for real. Grouped on the controls — swapping the preview must not
       move the sliders underneath it. */
    id: 'motionlab/preview-tear',
    screen: 'motionlab',
    group: 'motionlab-preview',
    scope: '.ctrl',
    setup () { reset() },
    async act ({ click, raf, at }) {
      await click('.uiplay', 0)
      await raf()
      const run = uiLast('tear')
      if (!run) throw new Error('the lab did not play the tear')
      run.timeline.pause(at === null ? 0.5 : at)
      await raf()
    }
  }
]
