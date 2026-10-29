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

import gsap from 'gsap'
import { store, resetStore } from '../../src/store.js'
import * as game from '../../src/game.js'
import { uiRunning, uiLast, UI_TIME, setReduced } from '../../src/ui/motion.js'
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
  setReduced(false)
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
    if (upto === 'matchmaking' || upto === 'confirm') return
    game.confirmBet(stake === null ? fee : stake)
    if (upto === 'toss') return
    game.runToss()
    if (upto === 'match') return
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


/* Reach a named presentation beat through the actual compiled timeline. */
async function seekMatchBeat (name, offset, raf) {
  const tl = timeline()
  const at = tl.labels[name]
  if (at === undefined) throw new Error('missing match beat: ' + name)
  tl.pause(0)
  for (let t = 0; t < at + offset; t += .2) { tl.time(t, false); await raf() }
  tl.time(at + offset, false); await raf()
  return { tl } // GSAP timelines are thenable; returning one would await its end.
}
function assertPenaltyIntro () {
  if (getComputedStyle(document.querySelector('.pk-intro')).visibility !== 'visible') throw new Error('penalty intro not visible')
  if (getComputedStyle(document.querySelector('.pk')).visibility !== 'hidden') throw new Error('penalty camera appeared before intro ended')
  if (timeline().timeScale() !== 1) throw new Error('intro accelerated by fast mode or cap')
  const score = document.querySelector('.pi-score').textContent.replace(/\s/g, '')
  if (score !== game.matchView.homeScore + ':' + game.matchView.awayScore) throw new Error('intro shows wrong regular-time score')
  if (Math.abs(timeline().labels['penalty-first-faceoff'] - timeline().labels['penalty-intro'] - 2.98) > .01) throw new Error('intro reading time changed')
}


function assertFaceoff (event) {
  const face = document.querySelector('.pk-faceoff')
  if (Number(getComputedStyle(face).opacity) < .99) throw new Error('face-off not fully visible')
  if (Number(getComputedStyle(document.querySelector('.pk-goal')).opacity) > .01) throw new Error('camera replaced the cards too soon')
  for (const kind of ['shooter', 'keeper']) {
    const card = document.querySelector('.pk-card.' + kind)
    if (Number(getComputedStyle(card).opacity) < .99) throw new Error(kind + ' card not fully visible')
    if (card.querySelector('.cf-name').textContent !== event[kind + 'Name']) throw new Error('wrong ' + kind + ' shown in face-off')
  }
  if (timeline().timeScale() > 1) throw new Error('face-off accelerated')
  if (timeline().labels['penalty-first-camera'] - timeline().labels['penalty-first-faceoff'] < 2.39) throw new Error('face-off hold too short')
}


function prepareLiveOutcome (won, wantPk = true) {
  reset(); richCollection()
  for (let i = 0; i < 300; i++) {
    game.abandonMatch()
    flow('match', { wantPk, seed: 11 + i * 7 })
    if (game.matchView.won === won && game.matchView.wentToPk === wantPk) return
  }
  throw new Error('could not prepare match outcome')
}
function endPresentation () { timeline().pause().progress(1, false) }
function assertMatchSummary (won) {
  const summary = document.querySelector('.match-summary')
  if (!summary || document.querySelector('.vc')) throw new Error('summary not visible by itself')
  if (summary.querySelector('h1').textContent !== (won ? 'VICTORY' : 'DEFEAT')) throw new Error('wrong summary outcome')
  const digits = [...summary.querySelectorAll('.primary-score b')].map(el => Number(el.textContent))
  const m = game.matchView
  if (digits[0] !== (m.wentToPk ? m.pkHome : m.homeScore) || digits[1] !== (m.wentToPk ? m.pkAway : m.awayScore)) throw new Error('wrong primary score')
  if (summary.querySelector('details').open) throw new Error('highlights should start collapsed')
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
  store.pendingPulls = seeded(1000, () => game.purchasePack(PACKS.find(p => p.id === id)))
}

function finishPackReveal() {
  for (const name of ['cardReveal','cardEpicReveal','cardLegendaryReveal']) uiLast(name)?.skip()
}

function assertSummaryLayout() {
  const slots=[...document.querySelectorAll('.sum-slot')].map(el=>el.getBoundingClientRect())
  const grid=document.querySelector('.sum-grid').getBoundingClientRect()
  if(slots.length!==5||slots.some(r=>Math.abs(r.width-slots[0].width)>.75||Math.abs(r.height-slots[0].height)>.75))throw new Error('All five summary cards must keep equal dimensions')
  if(Math.abs((slots[3].left+slots[4].right)/2-(grid.left+grid.right)/2)>.75||Math.abs(slots[3].top-slots[4].top)>.75)throw new Error('The last two cards must form a centered second row')
  if(document.querySelector('.opening-heading'))throw new Error('Summary must have one centered headline, without the old duplicate heading')
}

async function openPack (click, raf) {
  await click('[data-sfx="tear"]')
  const run = uiLast('tear')
  if (!run) throw new Error('the pack did not tear')
  run.skip()
  await raf()
  await raf()
  finishPackReveal()
  await raf()
}

async function advancePack(click, raf) {
  finishPackReveal()
  await click('.card-hit')
  uiLast('cardToss')?.skip()
  await raf()
  await raf()
  finishPackReveal()
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

  {
    id: 'draw/celebration', screen: 'home', scope: '.dr',
    setup () { reset(); richCollection(); store.tickets = 22; game.runSeasonDraw(true); store.overlay = 'draw' },
    async act ({ sleep }) {
      const cash = store.cash, season = store.jackpot.season, saved = JSON.stringify(store.jackpot.lastDraw)
      const root = document.querySelector('.dr'), canvas = root.querySelector('canvas')
      if (!canvas || !root.classList.contains('motion')) throw new Error('jackpot celebration did not start')
      const pixels = canvas.toDataURL(), beam = getComputedStyle(root.querySelector('.dr-beams'), '::before').transform
      await sleep(300)
      if (pixels === canvas.toDataURL() || beam === getComputedStyle(root.querySelector('.dr-beams'), '::before').transform) throw new Error('jackpot light or particles are static')
      for (const sibling of root.parentElement.children) if (sibling !== root && !sibling.inert) throw new Error('background remains interactive behind draw')
      if (document.activeElement !== root) throw new Error('draw does not own keyboard focus')
      await sleep(900)
      if (root.querySelector('.dr-prize .count-up').textContent !== '₦' + store.jackpot.lastDraw.prize.toLocaleString()) throw new Error('jackpot count-up did not reach prize')
      if (store.cash !== cash || store.jackpot.season !== season || JSON.stringify(store.jackpot.lastDraw) !== saved) throw new Error('presentation modified draw settlement')
    }
  },
  {
    id: 'draw/reduced', screen: 'home', scope: '.dr',
    setup () { reset(); richCollection(); store.tickets = 22; game.runSeasonDraw(true); store.overlay = 'draw'; setReduced(true) },
    act () {
      const root = document.querySelector('.dr')
      if (root.classList.contains('motion') || root.querySelector('canvas') || root.querySelector('.count-up').textContent !== '₦' + store.jackpot.lastDraw.prize.toLocaleString()) throw new Error('reduced motion draw must show full prize immediately')
    }
  },
  {
    id: 'draw/large-prize', screen: 'home', scope: '.dr', wait: 1600,
    setup () { reset(); richCollection(); store.tickets = 22; store.jackpot.pool = 999999999; game.runSeasonDraw(true); store.overlay = 'draw' }
  },
  {
    id: 'draw/single-ticket', screen: 'home', scope: '.dr',
    setup () { reset(); richCollection(); store.tickets = 1; game.runSeasonDraw(false); store.overlay = 'draw' },
    act () { if (document.querySelector('.dr-row.odds dd').firstChild.textContent !== '1 in 48,310') throw new Error('single-ticket odds mismatch') }
  },
  {
    id: 'draw/reopen-safe', screen: 'home', scope: '.dr',
    setup () { reset(); richCollection(); store.tickets = 22; game.runSeasonDraw(true); store.overlay = 'draw' },
    async act ({ click, sleep }) {
      const root = document.querySelector('.dr'), saved = JSON.stringify(store.jackpot.lastDraw), cash = store.cash, diamonds = store.diamonds, season = store.jackpot.season
      await click('.dr-go'); await sleep(100)
      if (document.querySelector('.dr') || document.querySelector('.topbar').inert || document.querySelector('.screen').inert || store.flags.seenDraw !== season - 1) throw new Error('draw did not dismiss cleanly')
      game.openLastSeasonDraw(); await sleep(400)
      if (!document.querySelector('.dr') || document.querySelector('.dr') === root || store.cash !== cash || store.diamonds !== diamonds || store.jackpot.season !== season || JSON.stringify(store.jackpot.lastDraw) !== saved) throw new Error('reopening drew or paid again')
    }
  },
  {
    id: 'draw/keyboard-close', screen: 'home',
    setup () { reset(); richCollection(); store.tickets = 22; game.runSeasonDraw(false); store.overlay = 'draw' },
    async act ({ nextTick }) {
      const root = document.querySelector('.dr')
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
      if (document.activeElement !== root.querySelector('.dr-go')) throw new Error('draw focus escaped dialog')
      root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await nextTick()
      if (document.querySelector('.dr') || document.querySelector('.screen').inert) throw new Error('Escape did not close draw or restore background')
    }
  },
  {
    id: 'draw/focus-return', screen: 'home',
    setup () { reset(); richCollection(); store.tickets = 22; game.runSeasonDraw(false); store.overlay = null },
    async act ({ click, nextTick }) {
      const opener = document.querySelector('.jp-link'); opener.focus(); await click('.jp-link')
      if (!document.querySelector('.dr') || document.activeElement !== document.querySelector('.dr')) throw new Error('draw did not receive focus')
      await click('.dr-go'); await nextTick()
      if (document.activeElement !== opener || opener.closest('[inert]')) throw new Error('closing draw did not restore opener focus')
    }
  },
  {
    id: 'draw/early-close', screen: 'home',
    setup () { reset(); richCollection(); store.tickets = 22; game.runSeasonDraw(true); store.overlay = 'draw' },
    async act ({ click, sleep }) {
      const cash = store.cash
      await click('.dr-go'); await sleep(1200)
      if (document.querySelector('.dr') || document.querySelector('.draw-particles') || store.cash !== cash || document.querySelector('.screen').inert) throw new Error('closing during animation leaked presentation or paid twice')
    }
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
  { id: 'cards/detail-max-level', screen: 'cards', setup () { reset(); store.ownedCards.G1 = { level: 10, shards: 99 }; store.cardTarget = 'G1' }, act () {
    if (!document.querySelector('.max-level-panel') || document.querySelector('.shard-track') || document.querySelector('.detail-upgrade')) throw new Error('Max-level cards must not offer another upgrade')
  } },
  { id: 'cards/detail-locked-shards', screen: 'cards', setup () { reset(); store.ownedCards.F12 = { level: 0, shards: 1 }; store.cardTarget = 'F12' }, act () {
    if (!document.querySelector('.unowned-panel .saved-shards') || document.querySelector('.shard-track') || document.querySelector('.hero .cf-lv').textContent.trim()) throw new Error('Uncollected shards must not suggest ownership or an upgrade path')
  } },
  { id: 'cards/detail-one-shard-short', screen: 'cards', setup () { reset(); store.ownedCards.G1 = { level: 1, shards: 1 }; store.cardTarget = 'G1' }, act () {
    const button = document.querySelector('.detail-upgrade')
    if (!button?.disabled || button.textContent.trim() !== 'Need 1 more shard') throw new Error('One missing shard must be singular and disable the upgrade action')
  } },
  { id: 'cards/detail-shop-link', screen: 'cards', setup () { reset(); store.cardTarget = 'G1' }, async act ({ click }) {
    await click('.detail-shop')
    if (store.currentScreen !== 'shop') throw new Error('The card-pack link must open Shop')
    store.cardTarget = 'G1'; game.go('cards')
  } },
  { id: 'cards/detail-upgrade-link', screen: 'cards', setup () { reset(); store.ownedCards.G1 = { level: 1, shards: 2 }; store.cardTarget = 'G1' }, async act ({ click }) {
    await click('.detail-upgrade')
    if (store.currentScreen !== 'upgrade' || store.upgradeTarget !== 'G1') throw new Error('Upgrade must open the existing upgrade screen for this player')
    store.cardTarget = 'G1'; game.go('cards')
  } },

  /* ------------------------------------------------ Shop */
  { id: 'shop/affordable', screen: 'shop', group: 'shop-packs', setup () { reset(); store.diamonds = 900 } },
  { id: 'shop/standard-only', screen: 'shop', setup () { reset(); store.diamonds = 100 }, act () {
    if (document.querySelector('[data-pack="standard"]').disabled || !document.querySelector('[data-pack="gold"]').disabled) throw new Error('100 diamonds must enable only the Standard Pack')
  } },
  { id: 'shop/gold-rates', screen: 'shop', setup () { reset() }, async act ({ click }) {
    await click('[data-odds="gold"]')
    const rates = [...document.querySelectorAll('.orow strong')].map(el => el.textContent.trim())
    if (rates.join(',') !== '50%,20%,28%,2%') throw new Error('Gold drop-rate sheet must show the published per-card probabilities')
  } },
  { id: 'shop/odds-dismiss', screen: 'shop', setup () { reset() }, async act ({ click, nextTick }) {
    await click('[data-odds="standard"]')
    document.querySelector('.close-odds').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick(); await nextTick()
    if (document.querySelector('.sheet') || document.activeElement !== document.querySelector('[data-odds="standard"]')) throw new Error('Escape must close the sheet and restore focus to its trigger')
  } },
  ...['standard', 'gold'].map(id => ({ id: `shop/purchase-${id}`, screen: 'shop', setup () { reset(); store.diamonds = 1000 }, async act ({ click, sleep }) {
    const copies = () => Object.values(store.ownedCards).reduce((n, e) => n + (e.level > 0 ? 1 : 0) + e.shards, 0)
    const before = copies()
    const image = document.querySelector(`.${id} .pack-artwork`).src
    await click(`[data-pack="${id}"]`); await sleep(450)
    const pack = PACKS.find(p => p.id === id)
    if (store.diamonds !== 1000 - pack.price || copies() - before !== 5 || store.currentScreen !== 'packopen') throw new Error('Buying must charge once and grant all five cards before the reveal')
    const halves = [...document.querySelectorAll('.seal .pack-artwork')]
    if (halves.length !== 2 || halves.some(el => el.src !== image)) throw new Error('Shop and both tear halves must share exactly the same pack asset')
    await click('.skip-results')
    const actual=[...document.querySelectorAll('.sum-grid .cf')].map(el=>['C','R','E','L'].find(r=>el.classList.contains('r-'+r))).join('')
    if(actual!==(id==='gold'?'CCREL':'CCCRR'))throw new Error('Every demo pack must use its exact requested rarity composition')
    game.go('shop')
  } })),
  { id: 'shop/pity-demo', screen: 'shop', setup () { reset() }, act () {
    if (document.querySelector('.demo-label')?.textContent.trim() !== 'Demo' || document.querySelector('.pity [role="progressbar"], .pity .bar')) throw new Error('Illustrative pity counters must be labelled Demo without a live progress bar')
  } },
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
  { id: 'tasks/mixed', screen: 'tasks', group: 'tasks-claim', setup () { reset() }, act () {
    if([...document.querySelectorAll('.mission')].map(el=>el.dataset.task).join(',')!=='t2,t3,t1')throw new Error('Ready missions must come before ongoing and claimed missions')
    if(['ready','ongoing','claimed'].some(k=>document.querySelector(`.${k}-count strong`).textContent!=='1'))throw new Error('Mission overview must reflect the live task states')
  } },
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

  {id:'tasks/repeat-claim',screen:'tasks',setup(){reset()},async act({click}){
    const button=document.querySelector('.claim');await click('.claim')
    button.dispatchEvent(new MouseEvent('click',{bubbles:true}))
    if(store.diamonds!==1030||!button.disabled||document.querySelector('.ready-count strong').textContent!=='0'||document.querySelector('.claimed-count strong').textContent!=='2')throw new Error('A repeated claim must award exactly once and update counts immediately')
  }},
  {id:'tasks/multiple-ready',screen:'tasks',setup(){reset();store.tasks[0].claimed=false},async act({click}){
    await click('.claim',0);await click('.claim',1)
    if(store.diamonds!==1040||document.querySelector('.ready-count strong').textContent!=='0'||[...document.querySelectorAll('.claim')].some(b=>!b.disabled))throw new Error('Separate ready missions must grant their own rewards once')
  }},
  {id:'tasks/all-claimed',screen:'tasks',setup(){reset();store.tasks.forEach(t=>{t.done=true;t.claimed=true})},act(){
    if(document.querySelector('.claim')||document.querySelector('.claimed-count strong').textContent!=='3')throw new Error('Claimed missions must not offer another reward')
  }},
  {id:'tasks/all-ongoing',screen:'tasks',setup(){reset();store.tasks.forEach(t=>{t.done=false;t.claimed=false})},act(){
    const bar=document.querySelector('[role="progressbar"]')
    if(document.querySelector('.claim')||document.querySelector('.ongoing-count strong').textContent!=='3'||bar?.getAttribute('aria-valuenow')!=='0'||bar?.getAttribute('aria-valuemax')!=='1')throw new Error('Incomplete tasks must retain their actual progress without a Claim or Start action')
  }},
  {id:'tasks/empty',screen:'tasks',setup(){reset();store.tasks=[]},act(){
    if(document.querySelector('.mission')||!document.querySelector('.empty-missions'))throw new Error('An empty mission list needs an honest empty state')
  }},
  {id:'tasks/leave-during-claim',screen:'tasks',setup(){reset()},async act({click,sleep}){
    await click('.claim');game.go('cards');await sleep(450)
    if(document.querySelector('.fly')||document.querySelector('.mission-toast')||store.diamonds!==1030)throw new Error('Leaving missions must clean up flights and notifications without undoing the reward')
    game.go('tasks');await sleep(450)
    if(document.querySelector('.claim')||document.querySelector('.mission')?.dataset.task!=='t3')throw new Error('Re-entering must prioritize remaining ongoing missions without replaying rewards')
  }},

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

  {
    id: 'history/filters', screen: 'history', setup () { reset(); richCollection(); settledMatch({ wantWin: true, seed: 3 }); settledMatch({ wantWin: false, seed: 5 }) },
    async act ({ click }) {
      const before = JSON.stringify(store.history), cash = store.cash
      await click('[data-filter="wins"]')
      if (document.querySelectorAll('.row').length !== store.history.filter(m => m.won).length || document.querySelector('.row.lost')) throw new Error('win filter mismatch')
      await click('[data-filter="losses"]')
      if (document.querySelectorAll('.row').length !== store.history.filter(m => !m.won).length || document.querySelector('.row.won')) throw new Error('loss filter mismatch')
      if (![...document.querySelectorAll('.record-net')].every(el => el.textContent.startsWith('−₦'))) throw new Error('loss net needs a minus sign')
      await click('[data-filter="all"]')
      if (store.cash !== cash || JSON.stringify(store.history) !== before) throw new Error('history filtering changed saved data')
    }
  },
  {
    id: 'history/filter-empty', screen: 'history', setup () { reset(); richCollection(); settledMatch({ wantWin: true, seed: 3 }) },
    async act ({ click }) { await click('[data-filter="losses"]'); if (!document.querySelector('.history-empty') || document.querySelector('.row')) throw new Error('empty filter state missing') }
  },
  {
    id: 'history/cards-full', screen: 'history', setup () { reset(); richCollection(); settledMatch({ wantWin: true, seed: 3 }); store.ownedCards.G1.level = 9 },
    async act ({ click, nextTick, sleep }) {
      await click('.row'); await nextTick(); await sleep(100)
      const cards = [...document.querySelectorAll('.deck .cf')]
      if (cards.length !== 4) throw new Error('history squad is incomplete')
      cards.forEach((card, i) => {
        const image = card.querySelector('.cf-art img'), box = card.querySelector('.cf-art').getBoundingClientRect(), r = image.getBoundingClientRect()
        if (!card.classList.contains('cf-full') || Math.abs(box.width-r.width) > 1 || Math.abs(box.height-r.height) > 1 || getComputedStyle(image).objectFit !== 'cover') throw new Error('history player art does not fill card')
        const saved = store.history[0].decks.you[['gk','df','mf','fw'][i]]
        if (card.querySelector('.cf-lv').textContent !== 'Lv.' + saved.level) throw new Error('history uses current level instead of saved level')
      })
      document.querySelector('.detail-scroll').scrollTop = document.querySelector('.saved-squad').offsetTop - 80
    }
  },
  {
    id: 'history/expanded', screen: 'history', setup () { reset(); richCollection(); settledMatch({ wantWin: true, seed: 3 }) },
    async act ({ click }) {
      await click('.row'); const y = document.querySelector('.history-actions').getBoundingClientRect().y
      await click('.bet-details summary'); await click('.goals-panel summary')
      if (!document.querySelector('.bet-details').open || !document.querySelector('.goals-panel').open) throw new Error('detail disclosures did not open')
      if (Math.abs(document.querySelector('.history-actions').getBoundingClientRect().y-y) > .1) throw new Error('expanding detail moved replay action')
      if (document.querySelectorAll('.goal-row').length !== store.history[0].script.events.filter(e => e.type === 'GOAL').length) throw new Error('history goals missing')
    }
  },
  {
    id: 'history/back-position', screen: 'history', setup () { reset(); richCollection(); settledMatch({ wantWin: true, seed: 3 }); settledMatch({ wantWin: true, seed: 9 }); settledMatch({ wantWin: false, seed: 5 }); const originals = [...store.history]; store.history = Array.from({ length: 15 }, (_, i) => ({ ...originals[i % originals.length], id: 'history-scroll-' + i, at: Date.now() - i * 3600000 })) },
    async act ({ click, nextTick }) {
      await click('[data-filter="wins"]'); const list = document.querySelector('.history-list'); list.scrollTop = 140; const y = list.scrollTop; if (y < 100) throw new Error('fixture must actually scroll')
      await click('.row'); await click('.tb-back'); await nextTick()
      if (Math.abs(document.querySelector('.history-list').scrollTop-y) > .1 || document.querySelector('[data-filter="wins"]').getAttribute('aria-pressed') !== 'true' || !document.activeElement.classList.contains('row')) throw new Error('back lost list position, filter or focus')
    }
  },
  {
    id: 'history/replay-safe', screen: 'history', setup () { reset(); richCollection(); settledMatch({ wantWin: false, seed: 5 }) },
    async act ({ sleep, click }) {
      await click('.row')
      const cash = store.cash, history = JSON.stringify(store.history), rank = JSON.stringify(store.rank), stats = JSON.stringify(store.stats), script = JSON.stringify(store.history[0].script)
      await click('.history-actions .btn'); await sleep(450)
      if (!game.ctx.replay || JSON.stringify(game.ctx.script) !== script || document.querySelector('.vc')) throw new Error('replay did not use saved script')
      await click('.ctrl .btn'); await click('[data-result-action]'); await sleep(450)
      if (store.currentScreen !== 'history' || game.ctx.replay) throw new Error('replay did not return to history')
      if (store.cash !== cash || JSON.stringify(store.history) !== history || JSON.stringify(store.rank) !== rank || JSON.stringify(store.stats) !== stats) throw new Error('replay modified settlement')
    }
  },
  {
    id: 'history/detail-no-pk', screen: 'history', setup () { reset(); richCollection(); settledMatch({ wantPk: false, wantWin: false, seed: 5 }) },
    async act ({ click }) { await click('.row'); if (document.querySelector('.regular-score') || document.querySelector('.detail-score h2').textContent !== 'FULL TIME') throw new Error('non-penalty detail duplicated score') }
  },
  {
    id: 'history/long-values', screen: 'history', setup () { reset(); richCollection(); settledMatch({ wantWin: true, seed: 3 }); const m = store.history[0]; m.opponent.handle = 'LagosChampionshipUnited'; m.net = 9876543; m.payout = m.stake + m.net },
    act: ({ click }) => click('.row')
  },

  /* ------------------------------------------------ Betting flow */
  { id: 'tierselect/locked', screen: 'tierselect', setup () { reset() } },
  { id: 'tierselect/unlocked', screen: 'tierselect', setup () { reset(); richCollection() } },
  {
    id: 'matchmaking/searching',
    screen: 'matchmaking',
    group: 'matchmaking-button',
    scope: '.match-actions .btn',
    setup () { reset(); richCollection(); store.pendingTier = 50 }
  },
  {
    /* Search and reveal share one persistent, fixed footer button. */
    id: 'matchmaking/found',
    screen: 'matchmaking',
    group: 'matchmaking-button',
    scope: '.match-actions .btn',
    wait: 3400,
    setup () { reset(); richCollection(); store.pendingTier = 50 }
  },
  {
    id: 'matchmaking/reveal', screen: 'matchmaking', group: 'matchmaking-button', scope: '.match-actions .btn', wait: 1700,
    setup () { reset(); richCollection(); store.pendingTier = 50 }
  },
  {
    id: 'matchmaking/reduced', screen: 'matchmaking', group: 'matchmaking-button', scope: '.match-actions .btn',
    setup () { reset(); richCollection(); store.pendingTier = 50; setReduced(true) }
  },
  {
    id: 'matchmaking/button-stability', screen: 'matchmaking', group: 'matchmaking-button', scope: '.match-actions .btn',
    setup () { reset(); richCollection(); store.pendingTier = 50 },
    async act ({ sleep }) {
      const button = document.querySelector('.match-actions .btn')
      const initial = button.getBoundingClientRect()
      const labels = new Set()
      const rotations = new Set()
      const cash = store.cash
      for (let i = 0; i < 44; i++) {
        const current = document.querySelector('.match-actions .btn')
        if (current !== button) throw new Error('matchmaking replaced the action button')
        const rect = current.getBoundingClientRect()
        for (const key of ['x','y','width','height']) {
          if (Math.abs(rect[key] - initial[key]) > .1) throw new Error('matchmaking button moved: ' + key)
        }
        labels.add(current.querySelector('span').textContent)
        if (document.querySelector('.duel-space.searching')) rotations.add(getComputedStyle(document.querySelector('.rival .crest-stage'), '::after').transform)
        await sleep(50)
      }
      if (!labels.has('Cancel search') || !labels.has('Review match')) throw new Error('did not observe both matchmaking states')
      if (rotations.size < 2) throw new Error('search scanner did not animate')
      if (store.cash !== cash || store.pendingBet) throw new Error('matchmaking charged a stake')
      if (/Candidates in queue|Both inside|Win chance/.test(document.querySelector('.mm').textContent)) throw new Error('technical log visible')
    }
  },
  { id: 'confirm/open', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm') } },
  { id: 'confirm/insufficient-cash', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm'); store.cash = 49 } },
  { id: 'confirm/rules-open', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm') }, act: ({ click }) => click('.fineprint summary') },
  { id: 'confirm/practice', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm', { fee: 10 }) } },
  { id: 'confirm/pro', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm', { fee: 200 }) } },
  { id: 'confirm/lineups-open', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm') }, act: ({ click }) => click('.lineups summary') },
  {
    id: 'confirm/typed-stake', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm') },
    async act ({ nextTick }) {
      const input = document.querySelector('#match-stake')
      input.value = '137'; input.dispatchEvent(new Event('input', { bubbles: true })); await nextTick()
      if (!document.querySelector('[data-sfx="confirm"]').textContent.includes('137')) throw new Error('typed stake did not update confirmation')
      const q = game.branchQuotes()
      const returns = [...document.querySelectorAll('.quote-return')].map(el => el.textContent.trim())
      if (returns[0] !== '₦' + Math.floor(137 * q.home).toLocaleString() || returns[1] !== '₦' + Math.floor(137 * q.away).toLocaleString()) throw new Error('typed stake did not update both returns')
    }
  },
  {
    id: 'confirm/invalid-stakes', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm') },
    async act ({ nextTick }) {
      const input = document.querySelector('#match-stake')
      const cash = store.cash
      for (const amount of ['', '0', '-1', '50.5', '200', 'NaN', '1e2', '99999999999999999']) {
        input.value = amount; input.dispatchEvent(new Event('input', { bubbles: true })); await nextTick()
        const button = document.querySelector('[data-sfx="confirm"]')
        if (!button.disabled || !document.querySelector('#stake-error')) throw new Error('invalid stake accepted: ' + amount)
        button.click(); await nextTick()
        if (store.cash !== cash || store.pendingBet) throw new Error('invalid stake charged the wallet')
        if ([...document.querySelectorAll('.quote-return')].some(el => el.textContent.trim() !== '—')) throw new Error('invalid stake displayed a return')
      }
    }
  },
  {
    id: 'confirm/stepper-and-presets', screen: 'confirm', setup () { reset(); richCollection(); flow('confirm') },
    async act ({ click }) {
      if (!document.querySelector('[aria-label="Decrease stake"]').disabled) throw new Error('minimum decrement enabled')
      await click('[aria-label="Increase stake"]')
      if (document.querySelector('#match-stake').value !== '51') throw new Error('increment failed')
      await click('[aria-label="Decrease stake"]')
      if (document.querySelector('#match-stake').value !== '50') throw new Error('decrement failed')
      await click('.presets button', 3)
      if (document.querySelector('#match-stake').value !== '199' || !document.querySelector('[aria-label="Increase stake"]').disabled) throw new Error('maximum preset failed')
      if (document.querySelector('.slider').value !== '199') throw new Error('slider not synchronized')
    }
  },
  { id: 'confirm/no-match' , screen: 'confirm', setup () { reset() } },
  {
    id: 'toss/spinning',
    screen: 'toss',
    group: 'toss-above-the-fold',
    scope: '.t-status, .locks',
    setup () { reset(); richCollection(); flow('toss') }
  },
  {
    /* same screen, 1.6s later: the result lands and prose appears BELOW the
       locks. The coin, the verdict line and the two price cells must not move */
    id: 'toss/landed',
    screen: 'toss',
    group: 'toss-above-the-fold',
    scope: '.t-status, .locks',
    wait: 2200,
    setup () { reset(); richCollection(); flow('toss') }
  },

  {
    id: 'toss/kickoff-transfer', screen: 'toss', scope: '.ko', wait: 2250,
    setup () { reset(); richCollection(); flow('toss') },
    async act ({ click, raf }) {
      const cash = store.cash, script = JSON.stringify(game.ctx.script)
      await click('.toss-actions .btn'); await raf()
      const tl = gsap.globalTimeline.getChildren().find(t => t.data === 'kickoff')
      if (!tl) throw new Error('kick-off timeline missing')
      tl.pause(); tl.time(.46, false); await raf()
      if (document.querySelector('.ko').dataset.phase !== 'football' || !document.querySelector('.toss-actions .btn').disabled) throw new Error('coin did not become football or button not locked')
      if (store.cash !== cash || JSON.stringify(game.ctx.script) !== script) throw new Error('visual transition changed match or balance')
    }
  },
  {
    id: 'toss/kickoff-complete', screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    async act ({ sleep }) {
      game.go('toss'); await sleep(2300)
      const cash = store.cash, script = JSON.stringify(game.ctx.script), count = store.history.length
      const button = document.querySelector('.toss-actions .btn'); button.click(); button.click()
      await sleep(1300)
      if (store.currentScreen !== 'match' || document.querySelector('.ko') || document.querySelector('.screen').inert) throw new Error('kick-off did not hand control to Live Match')
      if (store.cash !== cash || store.history.length !== count || JSON.stringify(game.ctx.script) !== script) throw new Error('kick-off redrew or settled match')
    }
  },
  {
    id: 'toss/kickoff-skip', screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    async act ({ sleep, click }) {
      game.go('toss'); await sleep(2300); await click('.toss-actions .btn'); await click('.ko'); await sleep(500)
      if (store.currentScreen !== 'match' || document.querySelector('.ko') || document.querySelector('.screen').inert) throw new Error('skipping kick-off left a blocker')
    }
  },
  {
    id: 'toss/kickoff-reduced', screen: 'match',
    setup () { reset(); richCollection(); flow('match'); setReduced(true) },
    async act ({ sleep, click }) {
      game.go('toss'); await sleep(2300); await click('.toss-actions .btn')
      if (document.querySelector('.ko-token') || !document.querySelector('.ko-reduced')) throw new Error('reduced motion still flies the football')
      await sleep(700)
      if (store.currentScreen !== 'match' || document.querySelector('.ko')) throw new Error('reduced handoff did not finish')
    }
  },
  {
    id: 'toss/kickoff-cancel', screen: 'home',
    setup () { reset(); richCollection(); flow('toss') },
    async act ({ sleep, click }) {
      game.go('toss'); await sleep(2300); await click('.toss-actions .btn'); await sleep(50); game.go('home'); await sleep(1100)
      if (store.currentScreen !== 'home' || document.querySelector('.ko') || document.querySelector('.screen').inert) throw new Error('leaving kick-off caused a late redirect or blocked input')
    }
  },

  /* ------------------------------------------------ Match */

  {
    id: 'match/ending-win-celebration', screen: 'match', setup () { prepareLiveOutcome(true) },
    async act ({ nextTick, sleep }) {
      const cash = store.cash, records = store.history.length
      endPresentation(); await nextTick(); await sleep(850)
      const overlay = document.querySelector('.vc.running')
      if (!overlay || document.querySelector('.match-summary') || document.querySelector('[data-result-action]')) throw new Error('winner must see celebration before summary')
      const canvas = overlay.querySelector('canvas'), first = canvas.toDataURL()
      await sleep(160)
      if (first === canvas.toDataURL()) throw new Error('victory particle field is static')
      if (store.cash !== cash || store.history.length !== records) throw new Error('celebration settled money early')
      overlay.dataset.capture = 'ready'
    }
  },
  {
    id: 'match/ending-win-auto', screen: 'match', setup () { prepareLiveOutcome(true); store.settings.fastMatch = true },
    async act ({ nextTick, sleep }) { endPresentation(); await nextTick(); await sleep(4300); assertMatchSummary(true) }
  },
  {
    id: 'match/ending-win-dismiss', screen: 'match', setup () { prepareLiveOutcome(true) },
    async act ({ nextTick, sleep, click }) { endPresentation(); await nextTick(); await sleep(850); await click('.victory-continue'); await sleep(280); assertMatchSummary(true) }
  },
  {
    id: 'match/ending-loss-pk', screen: 'match', setup () { prepareLiveOutcome(false) },
    async act ({ nextTick }) { const cash = store.cash; endPresentation(); await nextTick(); assertMatchSummary(false); if (store.cash !== cash) throw new Error('summary settled money early') }
  },
  {
    id: 'match/ending-loss-normal', screen: 'match', setup () { prepareLiveOutcome(false, false) },
    async act ({ nextTick }) { endPresentation(); await nextTick(); assertMatchSummary(false); if (document.querySelector('.regular-score')) throw new Error('non-penalty result shows duplicate score') }
  },
  {
    id: 'match/ending-win-normal', screen: 'match', setup () { prepareLiveOutcome(true, false) },
    async act ({ nextTick, sleep, click }) { endPresentation(); await nextTick(); await sleep(850); await click('.victory-continue'); await sleep(280); assertMatchSummary(true) }
  },
  {
    id: 'match/ending-highlights', screen: 'match', setup () { prepareLiveOutcome(false) },
    async act ({ nextTick, click }) {
      endPresentation(); await nextTick(); const before = document.querySelector('[data-result-action]').getBoundingClientRect()
      await click('.summary-highlights summary')
      if (!document.querySelector('.summary-highlights').open) throw new Error('highlights did not expand')
      const count = game.ctx.script.events.filter(e => e.type === 'GOAL').length + game.ctx.script.penalty.events.length
      if (document.querySelectorAll('.highlight-list li').length !== count) throw new Error('missing summary highlights')
      const after = document.querySelector('[data-result-action]').getBoundingClientRect()
      if (Math.abs(before.y - after.y) > .1) throw new Error('highlights moved the result action')
    }
  },
  {
    id: 'match/ending-win-skip', screen: 'match', setup () { prepareLiveOutcome(true) },
    async act ({ click, sleep }) {
      const cash = store.cash, count = store.history.length
      await click('.ctrl .btn')
      if (!document.querySelector('.vc') || document.querySelector('.match-summary')) throw new Error('live win Skip must show victory first')
      if (store.cash !== cash || store.history.length !== count) throw new Error('Skip celebration settled early')
      await sleep(950); document.querySelector('.vc').dataset.skipCapture = 'ready'
    }
  },
  {
    id: 'match/ending-reduced', screen: 'match', setup () { prepareLiveOutcome(true); setReduced(true) },
    act () { assertMatchSummary(true) }
  },
  {
    id: 'match/ending-replay-win', screen: 'match', setup () { reset(); richCollection(); game.startReplay(settledMatch({ wantPk: true, wantWin: true })) },
    async act ({ nextTick, sleep, click }) {
      const cash = store.cash, played = store.stats.played, count = store.history.length
      endPresentation(); await nextTick(); await sleep(850); await click('.victory-continue'); await sleep(280); assertMatchSummary(true)
      if (!document.querySelector('[data-result-action]').textContent.trim().startsWith('Done')) throw new Error('replay summary should return to history')
      if (store.cash !== cash || store.stats.played !== played || store.history.length !== count) throw new Error('replay changed settlement')
    }
  },
  {
    id: 'match/ending-replay-win-skip', screen: 'match', setup () { reset(); richCollection(); game.startReplay(settledMatch({ wantPk: true, wantWin: true })) },
    async act ({ click }) {
      const cash = store.cash, count = store.history.length, played = store.stats.played
      await click('.ctrl .btn'); assertMatchSummary(true)
      if (store.cash !== cash || store.history.length !== count || store.stats.played !== played) throw new Error('replay Skip changed settlement')
    }
  },
  {
    id: 'match/ending-replay-loss', screen: 'match', setup () { reset(); richCollection(); game.startReplay(settledMatch({ wantPk: true, wantWin: false })) },
    async act ({ nextTick }) { endPresentation(); await nextTick(); assertMatchSummary(false) }
  },
  {
    id: 'match/ending-settlement', screen: 'result', setup () { prepareLiveOutcome(true) },
    async act ({ sleep, click }) {
      game.go('match'); await sleep(550); await click('.ctrl .btn'); await click('.victory-continue'); await sleep(280); assertMatchSummary(true)
      const cash = store.cash, count = store.history.length, played = store.stats.played
      const button = document.querySelector('[data-result-action]')
      button.click(); button.click(); await sleep(550)
      if (store.currentScreen !== 'result' || store.history.length !== count + 1 || store.stats.played !== played + 1) throw new Error('result action must settle exactly once')
      if (store.cash !== cash + game.matchView.payout || store.pendingBet) throw new Error('result payout mismatch')
    }
  },
  {
    id: 'match/ending-replay-return', screen: 'history', setup () { reset(); richCollection(); game.startReplay(settledMatch({ wantPk: true, wantWin: false })) },
    async act ({ sleep, click }) {
      game.go('match'); await sleep(550); await click('.ctrl .btn'); assertMatchSummary(false)
      const cash = store.cash, played = store.stats.played, count = store.history.length
      await click('[data-result-action]'); await sleep(550)
      if (store.currentScreen !== 'history' || game.ctx.replay || document.querySelector('.vc')) throw new Error('replay did not return cleanly to history')
      if (store.cash !== cash || store.stats.played !== played || store.history.length !== count) throw new Error('replay return changed settlement')
    }
  },
  {
    id: 'match/ending-leave', screen: 'home', setup () { prepareLiveOutcome(true) },
    async act ({ nextTick, sleep }) {
      game.go('match'); await sleep(550); endPresentation(); await nextTick(); await sleep(750)
      if (!document.querySelector('.vc')) throw new Error('no celebration to clean up')
      game.go('home'); await sleep(400)
      if (document.querySelector('.vc')) throw new Error('celebration leaked after navigation')
    }
  },


  {
    id: 'match/faceoff-before-entry', screen: 'match', setup () { reset(); richCollection(); flow('match') },
    async act ({ raf }) {
      await seekMatchBeat('penalty-first-faceoff', -.14, raf)
      if (Number(getComputedStyle(document.querySelector('.pk-faceoff')).opacity) > .01) throw new Error('stale cards flashed before the real entrance')
      for (const card of document.querySelectorAll('.pk-card')) if (Number(getComputedStyle(card).opacity) > .01) throw new Error('uninitialized card visible')
    }
  },
  {
    id: 'match/faceoff-first', screen: 'match', setup () { reset(); richCollection(); flow('match') },
    async act ({ raf }) { await seekMatchBeat('penalty-first-faceoff', .55, raf); assertFaceoff(game.ctx.script.penalty.events[0]) }
  },
  {
    id: 'match/faceoff-fast', screen: 'match', setup () { reset(); richCollection(); flow('match'); store.settings.fastMatch = true },
    async act ({ raf, sleep }) {
      const { tl } = await seekMatchBeat('penalty-first-faceoff', .4, raf)
      tl.play(); await sleep(1400); tl.pause()
      assertFaceoff(game.ctx.script.penalty.events[0])
    }
  },
  {
    id: 'match/faceoff-replay', screen: 'match',
    setup () { reset(); richCollection(); const row = settledMatch({ wantPk: true, wantWin: true }); game.startReplay(row); store.settings.fastMatch = true },
    async act ({ raf }) {
      const cash = store.cash, played = store.stats.played
      await seekMatchBeat('penalty-first-faceoff', .55, raf)
      assertFaceoff(game.ctx.script.penalty.events[0])
      if (store.cash !== cash || store.stats.played !== played) throw new Error('replay changed settlement')
    }
  },
  {
    id: 'match/faceoff-decider', screen: 'match', setup () { reset(); richCollection(); flow('match') },
    async act ({ raf }) {
      await seekMatchBeat('penalty-decider-faceoff', .55, raf)
      assertFaceoff(game.ctx.script.penalty.events.filter(e => e.decisive).at(-1))
    }
  },
  {
    id: 'match/faceoff-skip', screen: 'match', setup () { reset(); richCollection(); flow('match') },
    async act ({ raf, click }) {
      await seekMatchBeat('penalty-first-faceoff', .55, raf)
      const cash = store.cash
      await click('.ctrl .btn')
      if (!!document.querySelector('.vc') !== game.matchView.won || (!game.matchView.won && !document.querySelector('.match-summary'))) throw new Error('Skip did not respect live win celebration')
      if (store.cash !== cash) throw new Error('Skip settled the bet')
    }
  },


  {
    id: 'match/transition-intro', screen: 'match', setup () { reset(); richCollection(); flow('match') },
    async act ({ raf }) { await seekMatchBeat('penalty-intro', .45, raf); assertPenaltyIntro() }
  },
  {
    id: 'match/transition-fast', screen: 'match', setup () { reset(); richCollection(); flow('match'); store.settings.fastMatch = true },
    async act ({ raf, sleep }) {
      const { tl } = await seekMatchBeat('penalty-intro', .45, raf)
      assertPenaltyIntro()
      const before = tl.time(), started = performance.now()
      tl.play(); await sleep(500); tl.pause()
      const rate = (tl.time() - before) / ((performance.now() - started) / 1000)
      if (rate < .75 || rate > 1.3) throw new Error('fast mode did not preserve real intro time: ' + rate)
      assertPenaltyIntro()
    }
  },
  {
    id: 'match/transition-first-kick', screen: 'match', setup () { reset(); richCollection(); flow('match') },
    async act ({ raf }) {
      await seekMatchBeat('penalty-first-kick', .08, raf)
      if (timeline().timeScale() > 1) throw new Error('first penalty accelerated past reading speed')
      if (getComputedStyle(document.querySelector('.pk-intro')).visibility !== 'hidden') throw new Error('intro still covers first penalty')
      if (getComputedStyle(document.querySelector('.pk')).visibility !== 'visible') throw new Error('first penalty missing')
    }
  },
  {
    id: 'match/transition-skip', screen: 'match', setup () { reset(); richCollection(); flow('match') },
    async act ({ raf, click }) {
      await seekMatchBeat('penalty-intro', .45, raf)
      const cash = store.cash
      await click('.ctrl .btn')
      if (getComputedStyle(document.querySelector('.pk-intro')).visibility !== 'hidden') throw new Error('Skip left intro visible')
      if (!!document.querySelector('.vc') !== game.matchView.won || (!game.matchView.won && !document.querySelector('.match-summary'))) throw new Error('Skip did not respect live win celebration')
      if (store.cash !== cash) throw new Error('Skip settled the bet')
    }
  },
  {
    id: 'match/transition-reduced', screen: 'match', setup () { reset(); richCollection(); flow('match'); setReduced(true) },
    act () {
      if (getComputedStyle(document.querySelector('.pk-intro')).visibility !== 'hidden') throw new Error('reduced motion left the intro active')
      if (!document.querySelector('.match-summary') || document.querySelector('.vc')) throw new Error('reduced motion did not reach summary')
    }
  },
  {
    id: 'match/transition-no-pk', screen: 'match', setup () { reset(); richCollection(); flow('match', { wantPk: false }) },
    async act ({ click }) {
      if (timeline().labels['penalty-intro'] !== undefined) throw new Error('non-penalty match received a shootout intro')
      await click('.ctrl .btn')
      if (getComputedStyle(document.querySelector('.pk-intro')).visibility !== 'hidden') throw new Error('non-penalty match shows shootout intro')
    }
  },

  {
    id: 'match/penalty-faceoff', screen: 'match',
    setup () { reset(); richCollection(); flow('match') },
    act: ({ raf }) => seekMatchBeat('penalty-decider-faceoff', .55, raf)
  },
  { id: 'match/reduced-motion', screen: 'match', setup () { reset(); richCollection(); flow('match'); setReduced(true) } },
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
  { id: 'packopen/gold-reveal', screen: 'packopen', setup () { reset(); richCollection(); store.diamonds = 900; boughtPack('gold') }, async act ({ click, raf }) {
    await openPack(click, raf)
    if (!document.querySelector('.reveal-card') || document.querySelector('.seal')) throw new Error('The new Gold artwork must tear into the existing card reveal')
  } },
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
    async act ({ click, raf }) { await openPack(click, raf); await advancePack(click, raf); await advancePack(click, raf) }
  },
  {
    /* the fifth card is the same screen two taps later, and it grows a
       "final card" line ABOVE the card */
    id: 'packopen/reveal-last',
    screen: 'packopen',
    group: 'packopen-reveal',
    setup () { reset(); richCollection(); boughtPack() },
    async act ({ click, raf }) { await openPack(click, raf); for (let i = 0; i < 4; i++) await advancePack(click, raf) }
  },
  {
    id: 'packopen/summary',
    screen: 'packopen',
    setup () { reset(); richCollection(); boughtPack() },
    async act ({ click, raf }) { await openPack(click, raf); for (let i = 0; i < 5; i++) await advancePack(click, raf); assertSummaryLayout() }
  },
  {id:'packopen/summary-gold',screen:'packopen',setup(){reset();boughtPack('gold')},async act({click}){
    await click('.skip-results');assertSummaryLayout()
    if(document.querySelector('.new-players').textContent.trim()!=='4 new players'||document.querySelector('.shard-stat').textContent.trim()!=='1 upgrade shard')throw new Error('Summary must show live counts and singular shard copy')
  }},
  {id:'packopen/summary-upgrade-inspect',screen:'packopen',setup(){reset();store.ownedCards.F16={level:1,shards:0};boughtPack('gold')},async act({click,raf}){
    await click('.skip-results');await click('.sum-slot',4);await raf()
    if(!document.querySelector('.detail-stage .btn-cta')?.textContent.includes('Upgrade Zuberi'))throw new Error('Eligible summary cards must retain their upgrade entrance')
    await click('.detail-stage > .btn:last-child');await raf();assertSummaryLayout()
  }},
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
      for (let i = 0; i < 5; i++) await advancePack(click, raf)
      await click('.sum-slot')
      await raf()
    }
  },

  ...[false,true].map(complete=>({id:'packopen/drag-'+(complete?'tear':'cancel'),screen:'packopen',setup(){reset();richCollection();boughtPack()},async act({raf,sleep}){
    const el=document.querySelector('.seal'),r=el.getBoundingClientRect(),x=r.left+r.width*.15,y=r.top+r.height*.12,dx=r.width*(complete?.6:.12)
    el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:2,clientX:x,clientY:y,bubbles:true}))
    el.dispatchEvent(new PointerEvent('pointermove',{pointerId:2,clientX:x+dx,clientY:y,bubbles:true}))
    el.dispatchEvent(new PointerEvent('pointerup',{pointerId:2,clientX:x+dx,clientY:y,bubbles:true}))
    if(complete){if(!uiLast('tear'))throw new Error('Dragging across the seam must tear the pack');if(document.querySelector('.reveal-card'))throw new Error('The pack must conceal results until torn');uiLast('tear').skip();await raf();await raf();finishPackReveal();await raf()}
    else{await sleep(300);if(uiLast('tear')||!document.querySelector('.seal'))throw new Error('A short drag must return to a sealed pack')}
  }})),
  ...[null,0,2,4,5].map(taps=>({id:'opening-ledger/exit-'+(taps===null?'sealed':taps),screen:'shop',setup(){reset();richCollection();store.diamonds=2000},async act({click,raf,sleep}){
    const copies=()=>Object.values(store.ownedCards).reduce((n,c)=>n+(c.level>=1?1:0)+c.shards,0)
    const gems=store.diamonds,held=copies()
    await click('.buy[data-pack="standard"]');await sleep(450)
    if(taps!==null){await openPack(click,raf);for(let i=0;i<taps;i++)await advancePack(click,raf)}
    await click('.tb-back');await sleep(450)
    if(store.currentScreen!=='shop'||gems-store.diamonds!==100||copies()-held!==5||document.querySelector('.ui-skip')||document.querySelector('.fly'))throw new Error('Every pack exit must preserve a single charge, all five cards, and no animation blockers')
  }})),

  // New gesture flow: skipping and interrupted gestures must never settle goods again.
  { id:'packopen/reveal-all-sealed', screen:'packopen', setup(){ reset(); richCollection(); boughtPack() }, async act({click}) {
    const before=JSON.stringify(store.ownedCards), gems=store.diamonds
    await click('.skip-results')
    if(document.querySelectorAll('.sum-slot').length!==5 || document.querySelector('.seal') || JSON.stringify(store.ownedCards)!==before || store.diamonds!==gems) throw new Error('Reveal all must show five already-granted cards without changing the ledger')
  } },
  { id:'packopen/skip-flipping', screen:'packopen', setup(){ reset(); richCollection(); boughtPack() }, async act({click,raf}) {
    await click('[data-sfx="tear"]'); uiLast('tear').skip(); await raf(); await raf()
    await click('.skip-results'); await raf()
    if(!document.querySelector('.sum-grid') || document.querySelector('.ui-skip') || document.querySelector('.fly')) throw new Error('Skipping a flip must cancel every active effect')
  } },
  { id:'packopen/keyboard-next', screen:'packopen', setup(){ reset(); richCollection(); boughtPack() }, async act({click,raf}) {
    await openPack(click,raf)
    document.querySelector('.card-hit').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))
    uiLast('cardToss').skip(); await raf(); await raf(); finishPackReveal(); await raf()
    if(!document.querySelector('.counter').textContent.includes('2 / 5')) throw new Error('Enter must reveal the second player')
  } },
  { id:'packopen/swipe-next', screen:'packopen', setup(){ reset(); richCollection(); boughtPack() }, async act({click,raf}) {
    await openPack(click,raf)
    const el=document.querySelector('.card-hit'), r=el.getBoundingClientRect(), x=r.left+r.width/2,y=r.top+r.height/2
    el.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,clientX:x,clientY:y,bubbles:true}))
    el.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x,clientY:y-90,bubbles:true}))
    el.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:x,clientY:y-90,bubbles:true}))
    uiLast('cardToss')?.skip(); await raf(); await raf(); finishPackReveal(); await raf()
    if(!document.querySelector('.counter').textContent.includes('2 / 5')) throw new Error('An upward swipe must advance exactly one card')
  } },
  { id:'packopen/rapid-clicks', screen:'packopen', setup(){ reset(); richCollection(); boughtPack() }, async act({click,raf}) {
    await openPack(click,raf); const hit=document.querySelector('.card-hit')
    hit.click();hit.click();hit.click();uiLast('cardToss').skip();await raf();await raf();finishPackReveal();await raf()
    if(!document.querySelector('.counter').textContent.includes('2 / 5')) throw new Error('Rapid input must not discard more than one card')
  } },
  ...['R','E','L'].map(rarity=>({ id:'packopen/rarity-'+rarity,screen:'packopen',setup(){reset();richCollection();store.diamonds=900;boughtPack(rarity==='R'?'standard':'gold')},async act({click,raf}){
    await openPack(click,raf);for(let i=0;i<(rarity==='E'?3:4);i++)await advancePack(click,raf)
    if(!document.querySelector('.reveal-card').classList.contains('r-'+rarity))throw new Error('The requested rarity must reach its own reveal treatment')
  }})),
  ...['E','L'].map(rarity=>({id:'packopen/charge-'+rarity,screen:'packopen',setup(){reset();richCollection();store.diamonds=900;boughtPack('gold')},async act({click,raf,at}){
    await openPack(click,raf)
    const count=rarity==='E'?3:4
    for(let i=0;i<count-1;i++)await advancePack(click,raf)
    await click('.card-hit');uiLast('cardToss').skip();await raf();await raf()
    const anim=uiLast(rarity==='E'?'cardEpicReveal':'cardLegendaryReveal')
    if(!anim || !anim.record.interruptible)throw new Error('High-rarity charge must be skippable')
    anim.timeline.pause(at===null?(rarity==='E'?.50:.90):at)
    await raf()
    if(document.querySelector('.verdict').getAttribute('aria-hidden')!=='true')throw new Error('The player result must stay concealed during the charge')
  }})),
  {id:'packopen/skip-legendary-charge',screen:'packopen',setup(){reset();richCollection();store.diamonds=900;boughtPack('gold')},async act({click,raf}){
    await openPack(click,raf);for(let i=0;i<3;i++)await advancePack(click,raf)
    await click('.card-hit');uiLast('cardToss').skip();await raf();await raf()
    const run=uiLast('cardLegendaryReveal');run.skip();await raf()
    if(document.querySelector('.ui-skip')||document.querySelector('.verdict').getAttribute('aria-hidden')==='true')throw new Error('Skipping Legendary charge must reveal the card and remove the blocker')
    await click('.skip-results');await raf()
    if(!document.querySelector('.sum-grid')||document.querySelector('.fly'))throw new Error('Reveal all must clean up high-rarity effects')
  }},
  { id:'packopen/ambient-active',screen:'packopen',setup(){reset();richCollection();store.diamonds=900;boughtPack('gold')},async act({click,raf,sleep}){
    await openPack(click,raf);for(let i=0;i<4;i++)await advancePack(click,raf)
    await sleep(100)
    const rays=document.querySelector('.legendary-rays'),canvas=document.querySelector('.pack-particles')
    const read=()=>({angle:getComputedStyle(rays,'::before').getPropertyValue('--pack-beam-angle'),pixels:canvas.toDataURL()})
    const a=read();await sleep(240);const b=read()
    if(a.angle===b.angle||a.pixels===b.pixels)throw new Error('Legendary beams and canvas particles must actually animate between frames')
  } },
  { id:'packopen/reduced-motion',screen:'packopen',setup(){reset();richCollection();store.diamonds=900;boughtPack('gold')},async act({click,raf,sleep}){
    setReduced(true)
    try{
      await openPack(click,raf);for(let i=0;i<4;i++)await advancePack(click,raf)
      await sleep(100)
      const rays=document.querySelector('.legendary-rays'),canvas=document.querySelector('.pack-particles'),card=document.querySelector('.reveal-card')
      if(getComputedStyle(rays,'::before').animationName!=='none')throw new Error('Reduced motion must stop the beam rotation and pulse')
      const pixels=canvas.toDataURL(),transform=getComputedStyle(card).transform
      await sleep(180)
      if(pixels!==canvas.toDataURL()||transform!==getComputedStyle(card).transform)throw new Error('Reduced motion must freeze the card and particle field')
      await advancePack(click,raf)
      if(!document.querySelector('.sum-grid')||document.querySelector('.ui-skip'))throw new Error('Reduced motion must reach summary without a blocker')
    }finally{setReduced(false)}
  } },

  /* ------------------------------------------------ Upgrade */
  { id: 'upgrade/no-card', screen: 'upgrade', setup () { reset() } },
  { id: 'upgrade/unowned-target', screen: 'upgrade', setup () { reset(); store.upgradeTarget = 'F12' }, act () {
    if (!document.querySelector('.no-card') || document.querySelector('[data-sfx="upgrade"]')) throw new Error('An unowned player cannot enter the upgrade transaction')
  } },
  { id: 'upgrade/exact-shards', screen: 'upgrade', setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 4 }; store.upgradeTarget = 'F2' }, async act ({ click }) {
    await click('[data-sfx="upgrade"]')
    if (store.ownedCards.F2.level !== 3 || store.ownedCards.F2.shards !== 0 || !document.querySelector('[data-sfx="upgrade"]').disabled) throw new Error('Exact-cost upgrade must deduct four shards once and disable the next upgrade')
    if (document.querySelector('.cost-balance').textContent.includes('-')) throw new Error('Insufficient shards must not display a negative projected balance')
  } },
  { id: 'upgrade/last-level', screen: 'upgrade', setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 9, shards: 200 }; store.upgradeTarget = 'F2' }, async act ({ click }) {
    await click('[data-sfx="upgrade"]')
    if (store.ownedCards.F2.level !== 10 || store.ownedCards.F2.shards !== 0 || document.querySelector('[data-sfx="upgrade"]') || document.querySelector('.hl').textContent.includes('11')) throw new Error('Final upgrade must stop at level ten without another cost or level preview')
  } },
  { id: 'upgrade/done-off-squad', screen: 'upgrade', setup () { reset(); richCollection(); store.ownedCards.F4 = { level: 2, shards: 4 }; store.upgradeTarget = 'F4' }, async act ({ click }) {
    const before = game.powerScore(game.deckPower())
    await click('[data-sfx="upgrade"]')
    if (store.ownedCards.F4.level !== 3 || !document.querySelector('.add-squad') || game.powerScore(game.deckPower()) !== before) throw new Error('An upgraded reserve must offer squad editing without changing current squad power')
  } },
  { id: 'upgrade/repeat', screen: 'upgrade', setup () { reset(); richCollection(); store.ownedCards.F2 = { level: 2, shards: 99 }; store.upgradeTarget = 'F2' }, async act ({ click }) {
    await click('[data-sfx="upgrade"]'); await click('[data-sfx="upgrade"]')
    if (store.ownedCards.F2.level !== 4 || store.ownedCards.F2.shards !== 87 || !document.querySelector('.done-banner').textContent.includes('Lv.4')) throw new Error('Repeated upgrades must use the new cost and refresh the receipt')
  } },
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
