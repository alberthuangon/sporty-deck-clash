/* Game actions — the bridge between the reactive store and the pure engine.
   Heavy engine objects (score matrices, team objects) are kept OUT of the
   reactive store in `ctx`; the store only holds display-safe scalars. */

import { reactive } from 'vue'
import cardData from './data/cards.json' with { type: 'json' }
import { store, go } from './store.js'
import { buildCard, RARITY, MAX_LEVEL } from './engine/cards.js'
import { buildTeam, priceMatch, drawResult, settle, powerOf, powerStars, powerScore, settlementBranch } from './engine/model.js'
import { findOpponent } from './engine/opponents.js'
import { buildScript } from './engine/scriptgen.js'
import { shardCost, TIERS, stakeRange, applyRankDelta, rankWin, RANK_LOSS, REWARD_ROAD, ladderIndex, rankLabel, rollPack } from './engine/economy.js'

export const CATALOGUE = cardData.cards
export const BY_ID = Object.fromEntries(CATALOGUE.map(c => [c.id, c]))

/* Non-reactive match context. aIsHome is drawn when the match is created and
   lives ONLY here until the toss reveals it — it must never reach matchView,
   which is what the screens render (PRD v0.21 §3.9). */
export const ctx = {
  priced: null, result: null, script: null, opponent: null, playerTeam: null,
  aIsHome: null, replay: false
}

/* reactive, display-safe mirror of the current match */
export const matchView = reactive({
  active: false, tierFee: 0, stake: 0,
  opponentName: '', opponentPower: 0,
  oddsIfHome: 0, oddsIfAway: 0, myOdds: 0, myQ: 0,
  aIsHome: null, homeScore: 0, awayScore: 0,
  wentToPk: false, pkHome: 0, pkAway: 0, won: false,
  payout: 0, rankDelta: 0, promotions: []
})

/* ---------- collection ---------- */

export function owned (id) {
  const e = store.ownedCards[id]
  return !!e && e.level >= 1
}
export function entry (id) {
  return store.ownedCards[id] || { level: 0, shards: 0 }
}
export function cardOf (id) {
  return buildCard(BY_ID[id], Math.max(1, entry(id).level))
}
export function ownedIds () {
  return CATALOGUE.filter(c => owned(c.id)).map(c => c.id)
}
export function upgradeCost (id) {
  const e = entry(id)
  if (e.level < 1 || e.level >= MAX_LEVEL) return null
  return shardCost(BY_ID[id].rarity, e.level)
}
export function canUpgrade (id) {
  const cost = upgradeCost(id)
  return cost !== null && entry(id).shards >= cost
}
export function upgradeCard (id) {
  if (!canUpgrade(id)) return false
  const e = store.ownedCards[id]
  e.shards -= upgradeCost(id)
  e.level += 1
  return true
}
export function addShards (id, n) {
  if (!store.ownedCards[id]) store.ownedCards[id] = { level: 0, shards: 0 }
  store.ownedCards[id].shards += n
}
export function grantCard (id) {
  if (!store.ownedCards[id]) store.ownedCards[id] = { level: 0, shards: 0 }
  if (store.ownedCards[id].level === 0) { store.ownedCards[id].level = 1; return 'new' }
  addShards(id, 1)
  return 'shard'
}

/* ---------- squad ---------- */

export function deckCards () {
  return {
    gk: cardOf(store.deck.gk),
    fw: cardOf(store.deck.fw),
    mf: cardOf(store.deck.mf),
    df: cardOf(store.deck.df)
  }
}

export function teamFromDeck (deck = store.deck, name = 'Your Squad') {
  return buildTeam({
    gk: { def: BY_ID[deck.gk], level: entry(deck.gk).level || 1 },
    fw: { def: BY_ID[deck.fw], level: entry(deck.fw).level || 1 },
    mf: { def: BY_ID[deck.mf], level: entry(deck.mf).level || 1 },
    df: { def: BY_ID[deck.df], level: entry(deck.df).level || 1 }
  }, name)
}

export function deckPower (deck = store.deck) { return powerOf(teamFromDeck(deck)) }

/* Squad power with some card levels overridden, WITHOUT touching the store.
   The Upgrade screen needs "what would Power be one level up"; answering that
   by writing the level into the store and writing it back is a reactive write
   inside a render pass, which spins Vue forever and freezes the tab. */
export function deckPowerWith (levels = {}, deck = store.deck) {
  const spec = {}
  for (const slot of ['gk', 'fw', 'mf', 'df']) {
    const id = deck[slot]
    spec[slot] = { def: BY_ID[id], level: levels[id] ?? (entry(id).level || 1) }
  }
  return powerOf(buildTeam(spec, 'Your Squad'))
}
export { powerStars, powerScore }

/* home/away lean of the squad, for the "betting on the toss" indicator */
export function venueLean (deck = store.deck) {
  const t = teamFromDeck(deck)
  const h = t.homeAtk + t.homeDef
  const a = t.awayAtk + t.awayDef
  return (h - a) / (h + a)          // >0 home-leaning, <0 away-leaning
}

/* "collection power" = the strongest squad this account can field (PRD §6.5).
   Memoised on the collection signature: this is O(keepers x outfield^3) and
   both Home and TierSelect read it on every render. */
let colCache = { sig: null, value: 0 }

function collectionSignature () {
  return Object.entries(store.ownedCards)
    .map(([id, e]) => id + ':' + e.level)
    .sort()
    .join('|')
}

export function collectionPower () {
  const sig = collectionSignature()
  if (colCache.sig === sig) return colCache.value
  const value = computeCollectionPower()
  colCache = { sig, value }
  return value
}

function computeCollectionPower () {
  const gks = ownedIds().filter(id => BY_ID[id].class === 'gk')
  const ofs = ownedIds().filter(id => BY_ID[id].class === 'outfield')
  if (!gks.length || ofs.length < 3) return 0
  let best = 0
  for (const gk of gks) {
    for (let i = 0; i < ofs.length; i++) {
      for (let j = 0; j < ofs.length; j++) {
        for (let k = 0; k < ofs.length; k++) {
          if (i === j || j === k || i === k) continue
          best = Math.max(best, deckPower({ gk, fw: ofs[i], mf: ofs[j], df: ofs[k] }))
        }
      }
    }
  }
  return best
}

/* best assignment of three chosen outfield cards (PRD §5 auto-placement) */
export function bestPlacement (gk, three) {
  let best = null
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        if (i === j || j === k || i === k) continue
        const deck = { gk, fw: three[i], mf: three[j], df: three[k] }
        const p = deckPower(deck)
        if (!best || p > best.power) best = { deck, power: p }
      }
    }
  }
  return best
}

export function tierUnlocked (tier) { return collectionPower() >= tier.unlockPower }
export { TIERS, stakeRange, rankLabel, REWARD_ROAD, ladderIndex, RARITY, MAX_LEVEL, rollPack }

/* ---------- missions ---------- */

export function claimTask (id) {
  const t = store.tasks.find(x => x.id === id)
  if (!t || !t.done || t.claimed) return 0
  t.claimed = true
  store.diamonds += t.reward
  return t.reward
}

/* ---------- pack (scripted for the demo, PRD §6.2 Phase 0) ---------- */

/* The FIRST pack is scripted, because the demo's narrative depends on it
   (2 duplicates -> shards, a new Rare, Okonkwo last). Every pack after that is
   drawn for real from the published rate table, so the odds screen is not
   decoration — PRD §6.2. */
export const PACK_SCRIPT = ['F1', 'F4', 'F2', 'F11', 'F12']   // dupe, new, dupe, new R, Okonkwo E

/* THREE FUNCTIONS, BECAUSE THERE WERE THREE MOMENTS.

   This was one `buyPack` that charged, rolled and marked the first pack as
   seen, all at the instant the screen mounted — and the cards are handed over
   one tap at a time, several seconds later. Everything between those two
   moments was a window the player could walk out of, and all three ways out
   were broken:

     left on the sealed pack   100 diamonds gone, nothing granted
     left after two of five    100 gone, two granted, three lost
     left and bought again     the scripted five ran a second time, because
                               the "seen" flag was only set at the summary

   Charging later only narrows that window. What closes it is that money and
   cards move together: nothing is charged until the pack is torn, and from
   the moment it IS charged every card in it belongs to the player, whether
   they stay to watch or not (PackOpen's unmount hands over the rest).

   So: ask before the screen commits to anything, decide the cards without
   charging for them, and charge at the tear. */
export function canBuyPack (pack) { return store.diamonds >= pack.price }

/* WHICH five, decided without taking anything. Reads the seen-flag, so it has
   to run before payForPack sets it — which is also the right order for the
   player: the pack you are about to tear is the one you were promised. */
export function rollPackPulls (pack) {
  const defs = store.flags.packOpened
    ? rollPack(pack, CATALOGUE)
    : PACK_SCRIPT.map(id => BY_ID[id])
  // a real draw can repeat a card inside one pack, so "new" has to account for
  // the earlier cards in this same pack, not just what was owned beforehand
  const seen = new Set()
  return defs.map(def => {
    const isNew = !owned(def.id) && !seen.has(def.id)
    seen.add(def.id)
    return { id: def.id, def, isNew }
  })
}

/* The one moment money changes hands. The flag moves here from the summary
   screen for the same reason: a pack that has been torn has been opened, and
   deciding that three taps later is what let the demo script replay. */
export function payForPack (pack) {
  if (store.diamonds < pack.price) return false
  store.diamonds -= pack.price
  store.flags.packOpened = true
  return true
}

export function commitPull (pull) { return grantCard(pull.id) }

/* ---------- jackpot (PRD §6.7) ---------- */

/* Grand prize odds ONLY — never blended with the diamond prizes. A combined
   "chance of any prize" reads better and is a worse number to publish, which
   is the opposite of what this product is for (§6.7.3). */
export function grandPrizeOdds () {
  const { totalTickets } = store.jackpot
  if (!store.tickets || !totalTickets) return null
  return Math.round(totalTickets / store.tickets)
}

/* What the new season's reward road is holding. The soft reset clears
   peakNodes, so every ticket node on the road is unclaimed again — the road
   pays on arrival, so there is no "earned but unclaimed" state (§6.4.3). */
export function ticketsWaiting () {
  return REWARD_ROAD.reduce((n, node) => n + (node.reward.tickets || 0), 0)
}

export function timeToDraw (now = Date.now()) {
  const ms = store.jackpot.drawAt - now
  if (ms <= 0) return 'Drawing now'
  const days = Math.round(ms / 86400000)
  if (days >= 2) return `Draw in ${days} days`
  const hours = Math.round(ms / 3600000)
  if (hours >= 2) return `Draw in ${hours} hours`
  return `Draw in ${Math.max(1, Math.round(ms / 60000))} minutes`
}

/* Run the season draw and roll the season over. The figures shown on the
   result screen are the season that just ENDED, so they are captured before
   anything resets. Demo only: a real draw happens server-side from a seed
   published in advance. */
/* Demo figure: a pool large enough to read as a jackpot, varied per season. */
const DEMO_POOL = 2850182

/* The draw sits sealed until the player opens it. Opening an unopened season
   runs it; opening one already seen just shows it again — the result is a
   fact, and looking at it twice must not roll it twice. */
export function openLastSeasonDraw () {
  const sealed = !store.jackpot.lastDraw
  if (sealed) {
    enterTheDraw()
    const pick = store.settings.jackpotDemo
    runSeasonDraw(pick === 'won' ? true : pick === 'lost' ? false : Math.random() < 0.5)
  }
  store.overlay = 'draw'
}

export function drawIsSealed () {
  const d = store.jackpot.lastDraw
  return !d || store.flags.seenDraw !== d.season
}

/* Demo: put the draw back in its envelope so the next open runs a fresh one
   with whatever outcome has just been chosen. */
export function sealNextDraw () {
  store.jackpot.lastDraw = null
  store.overlay = null
}

/* A player who never climbed the road holds no tickets, and a draw they were
   not in has nothing to show: 0 of 48,310, odds "—", and — before this — a
   headline announcing they had won it. The demo entry points stand in for a
   season that was played, so they stand in for its tickets too: the road's
   full ticket value, which is exactly what the previous draw screen promised
   was "waiting on the reward road". */
export function enterTheDraw () {
  if (!store.tickets) store.tickets = ticketsWaiting()
}

export function runSeasonDraw (won) {
  const j = store.jackpot
  const seed = seasonSeed(j.season)
  const rng = mulberry(hashCode(seed))
  const myTickets = store.tickets
  /* you cannot win a draw you are not in */
  if (!myTickets) won = false

  /* The player's tickets are a block somewhere in the global range, placed by
     the same seed, so BOTH outcomes draw their winning number from one space.
     The first version gave a winner [1, myTickets] and everyone else
     everything above — internally consistent, but it quietly modelled a world
     where every player holds #1 upwards, and with two tickets it printed
     "Winning ticket #1" on the one screen whose whole job is being checkable.
     A five-figure number on both screens is not cosmetic here: #1 is exactly
     what a placeholder looks like. */
  const myFirst = 1 + Math.floor(rng() * Math.max(1, j.totalTickets - myTickets))
  const winningTicket = won
    ? myFirst + Math.floor(rng() * Math.max(1, myTickets))
    : ticketOutsideBlock(rng, j.totalTickets, myFirst, myTickets)

  j.lastDraw = {
    season: j.season,
    won,
    prize: j.pool,
    myTickets,
    totalTickets: j.totalTickets,
    winningTicket,
    seed
  }
  if (won) store.cash += j.pool

  // season N+1 starts now: soft reset, fresh pool, fresh road
  j.season += 1
  /* A new season's pool is fed by that season's rake, not by a slice of the
     last one. Carrying a fraction over compounded across demo draws — three
     presses took the headline from ₦2,850,182 to ₦41,043, which makes the
     jackpot look like loose change. Seeded, so a season's figures repeat. */
  j.pool = DEMO_POOL + Math.floor(rng() * 400000) - 200000
  j.drawAt = Date.now() + 6 * 86400000
  store.tickets = 0
  store.rank = { ...store.rank, peakNodes: [] }
  store.flags.seenDraw = j.lastDraw.season - 1      // this one has not been opened yet
}

/* A number in [1, total] that is not one of the player's: drawn from the
   complement and shifted past their block, so every other ticket in the draw
   is equally likely — rather than re-rolling until it happens to miss. */
function ticketOutsideBlock (rng, total, first, mine) {
  let t = 1 + Math.floor(rng() * Math.max(1, total - mine))
  if (t >= first) t += mine
  return Math.min(t, total)
}

function seasonSeed (season) {
  /* a published seed is a fixed string, not something generated per viewer */
  return `skd-s${season}-` + 'b7e3a1f94c2d8e05'.slice(0, 16)
}
function hashCode (str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry (a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- match flow ---------- */

export function startMatchmaking (tierFee) {
  const team = teamFromDeck()
  const found = findOpponent(team)
  if (!found.opponent) return null
  ctx.playerTeam = team
  ctx.opponent = found.opponent
  ctx.priced = found.priced
  // drawn now, revealed later — same rule as the result itself
  ctx.aIsHome = Math.random() < 0.5
  ctx.result = null
  ctx.script = null
  Object.assign(matchView, {
    active: true, tierFee, stake: tierFee,
    opponentName: found.opponent.handle,
    opponentPower: found.opponent.power,
    oddsIfHome: found.priced.branches.aHome.oddsA,
    oddsIfAway: found.priced.branches.bHome.oddsA,
    myOdds: 0, myQ: found.priced.qA,
    aIsHome: null, homeScore: 0, awayScore: 0,
    wentToPk: false, pkHome: 0, pkAway: 0, won: false,
    payout: 0, rankDelta: 0, promotions: []
  })
  return { ...found, candidates: found.walked }
}

/* Both branch prices, quoted and locked at confirm (PRD v0.21 §3.7).
   These ARE offers now — one of them settles the bet — so the screen shows
   them in IV odds cells, unlike the v0.20 design where they were hypothetical. */
export function branchQuotes () {
  if (!ctx.priced) return null
  const h = ctx.priced.branches.aHome
  const a = ctx.priced.branches.bHome
  return { home: h.oddsA, away: a.oddsA, qHome: h.qA, qAway: a.qA }
}

export function confirmBet (stake) {
  if (!ctx.priced) return false
  if (store.cash < stake) return false
  store.cash -= stake                    // PRD §3.8: deduct, then lock, then toss
  store.pendingBet = { stake, tierFee: matchView.tierFee }
  matchView.stake = stake
  return true
}

/* toss + draw + script, all in one deterministic step (PRD §14.2: the whole
   timeline is compiled before a single frame plays, which is what makes Skip
   safe) */
/* The toss REVEALS the assignment drawn at match creation; it does not decide
   it. Revealing is also when the realized price stops being two numbers and
   becomes one. */
export function runToss () {
  const opts = { forceDraw: store.settings.forcePkScenario, minTieGoals: 1 }
  let result = drawResult(ctx.priced, ctx.aIsHome, Math.random, opts)
  // presenter switch: keep redrawing until the player wins. Demo only — it is a
  // conditioned sample, so the stage show is guaranteed but the figures stop
  // representing the model. Off by default, never used by the sim harness.
  if (store.settings.forceWin) {
    for (let i = 0; i < 300 && result.winner !== 'A'; i++) {
      result = drawResult(ctx.priced, ctx.aIsHome, Math.random, opts)
    }
  }
  ctx.result = result
  ctx.script = buildScript(result, Math.random)
  matchView.aIsHome = result.aIsHome
  matchView.myOdds = settlementBranch(ctx.priced, result.aIsHome).oddsA
  matchView.homeScore = result.homeScore
  matchView.awayScore = result.awayScore
  matchView.wentToPk = result.wentToPk
  if (ctx.script.penalty) {
    matchView.pkHome = ctx.script.penalty.homeGoals
    matchView.pkAway = ctx.script.penalty.awayGoals
  }
  matchView.won = result.winner === 'A'
  return result
}

export const HISTORY_CAP = 20

function snapshotDeck (team) {
  const out = {}
  for (const slot of ['gk', 'df', 'mf', 'fw']) {
    out[slot] = { id: team.cards[slot].id, level: team.cards[slot].level }
  }
  return out
}

/* Rebuild a team from a snapshot, so a replay shows the cards AS THEY WERE —
   levelling one up afterwards must not retroactively change an old match. */
export function teamFromSnapshot (snap, name) {
  return buildTeam({
    gk: { def: BY_ID[snap.gk.id], level: snap.gk.level },
    df: { def: BY_ID[snap.df.id], level: snap.df.level },
    mf: { def: BY_ID[snap.mf.id], level: snap.mf.level },
    fw: { def: BY_ID[snap.fw.id], level: snap.fw.level }
  }, name)
}

function recordMatch (settlement, delta, promotions) {
  const r = ctx.result
  const br = settlementBranch(ctx.priced, r.aIsHome)
  store.history.unshift({
    id: 'm' + Date.now().toString(36),
    at: Date.now(),
    tierFee: matchView.tierFee,
    stake: matchView.stake,
    opponent: { handle: ctx.opponent.handle, power: ctx.opponent.power },
    oddsIfHome: ctx.priced.branches.aHome.oddsA,
    oddsIfAway: ctx.priced.branches.bHome.oddsA,
    odds: br.oddsA,
    aIsHome: r.aIsHome,
    decks: { you: snapshotDeck(ctx.playerTeam), them: snapshotDeck(ctx.opponent.team) },
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    wentToPk: r.wentToPk,
    pk: ctx.script.penalty ? { home: ctx.script.penalty.homeGoals, away: ctx.script.penalty.awayGoals } : null,
    won: r.winner === 'A',
    payout: settlement.payoutA,
    net: settlement.payoutA - matchView.stake,
    rankDelta: delta,
    promotions: promotions.map(p => ({ id: p.id, label: p.label, reward: p.reward })),
    script: ctx.script
  })
  if (store.history.length > HISTORY_CAP) store.history.length = HISTORY_CAP
}

/* settlement + rank, applied once the match animation is over */
export function finishMatch () {
  if (ctx.replay) return null            // a replay settles nothing, ever
  if (!store.pendingBet) return null     // already settled: settlement is single-shot
  store.pendingBet = null

  const s = settle(ctx.priced, ctx.result, matchView.stake, matchView.tierFee)
  const won = ctx.result.winner === 'A'
  store.cash += s.payoutA
  matchView.payout = s.payoutA

  // rank scores against the branch that actually happened (PRD v0.21 §6.4.1)
  const qRealized = settlementBranch(ctx.priced, ctx.result.aIsHome).qA
  const delta = won ? rankWin(qRealized) : RANK_LOSS
  const before = { ...store.rank }
  const { rank, promotions } = applyRankDelta(store.rank, delta)
  store.rank = { ...rank, peakNodes: before.peakNodes }

  // reward road: peak-based, first claim within the season (PRD §6.4.3)
  const claimed = []
  promotions.forEach(p => {
    const idx = ladderIndex(p.tierIndex, p.subtier) - 1
    const node = REWARD_ROAD[idx]
    if (node && !store.rank.peakNodes.includes(node.id)) {
      store.rank.peakNodes.push(node.id)
      if (node.reward.diamonds) store.diamonds += node.reward.diamonds
      if (node.reward.tickets) store.tickets += node.reward.tickets
      claimed.push(node)
    }
  })

  store.stats.played += 1
  if (won) store.stats.won += 1
  if (won && ctx.result.wentToPk) store.stats.pkWon += 1

  matchView.rankDelta = delta
  matchView.promotions = claimed
  recordMatch(s, delta, claimed)
  return { settle: s, delta, promotions: claimed }
}

/* ---------- replay (PRD v0.21 §3.1) ----------
   Feeds a stored script back through the same player. It never touches
   drawResult, never settles and never scores — the demo switches are
   meaningless here because the script is already a fact. */
export function startReplay (record) {
  const you = teamFromSnapshot(record.decks.you, 'You')
  const them = teamFromSnapshot(record.decks.them, record.opponent.handle)
  ctx.playerTeam = you
  ctx.opponent = { handle: record.opponent.handle, team: them, power: record.opponent.power }
  ctx.priced = null
  ctx.script = record.script
  ctx.aIsHome = record.aIsHome
  ctx.replay = true
  ctx.result = {
    home: record.aIsHome ? you : them,
    away: record.aIsHome ? them : you,
    homeScore: record.homeScore,
    awayScore: record.awayScore,
    wentToPk: record.wentToPk,
    aIsHome: record.aIsHome,
    winner: record.won ? 'A' : 'B'
  }
  Object.assign(matchView, {
    active: true, tierFee: record.tierFee, stake: record.stake,
    opponentName: record.opponent.handle, opponentPower: record.opponent.power,
    oddsIfHome: record.oddsIfHome, oddsIfAway: record.oddsIfAway,
    myOdds: record.odds, myQ: 0,
    aIsHome: record.aIsHome,
    homeScore: record.homeScore, awayScore: record.awayScore,
    wentToPk: record.wentToPk,
    pkHome: record.pk ? record.pk.home : 0,
    pkAway: record.pk ? record.pk.away : 0,
    won: record.won, payout: record.payout,
    rankDelta: record.rankDelta, promotions: []
  })
  go('match')
}

export function endReplay () {
  ctx.replay = false
  abandonMatch()
  go('history')
}

export function abandonMatch () {
  // cancelling before the toss refunds; after settlement pendingBet is already null
  if (store.pendingBet) {
    store.cash += store.pendingBet.stake
    store.pendingBet = null
  }
  matchView.active = false
  ctx.priced = null; ctx.result = null; ctx.script = null; ctx.aIsHome = null
  ctx.replay = false
}

export { go, store }
