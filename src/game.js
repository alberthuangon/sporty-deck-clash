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
export const ctx = { priced: null, result: null, script: null, opponent: null, playerTeam: null, aIsHome: null }

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

export function buyPack (pack) {
  if (store.diamonds < pack.price) return null
  store.diamonds -= pack.price
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

export function commitPull (pull) { return grantCard(pull.id) }

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

/* settlement + rank, applied once the match animation is over */
export function finishMatch () {
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
  return { settle: s, delta, promotions: claimed }
}

export function abandonMatch () {
  // cancelling before the toss refunds; after settlement pendingBet is already null
  if (store.pendingBet) {
    store.cash += store.pendingBet.stake
    store.pendingBet = null
  }
  matchView.active = false
  ctx.priced = null; ctx.result = null; ctx.script = null; ctx.aIsHome = null
}

export { go, store }
