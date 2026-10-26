/* Simulated opponent pool (PRD §11.3 "Demo 以模擬對手代替").
   Eight fixed squads spread across the Power range, built by the engine from
   the real card pool — no hand-written stats. Matchmaking runs the real
   two-stage search: Power coarse filter, then pairwise odds verification. */

import cardData from '../data/cards.json' with { type: 'json' }
import { buildTeam, priceMatch, powerOf, ODDS_CAP } from './model.js'

const CARDS = cardData.cards
const byId = Object.fromEntries(CARDS.map(c => [c.id, c]))

/* name pool is fictional, same naming rule as the card catalogue (PRD §4.6) */
const ROSTER = [
  { handle: 'AbujaArrow',      gk: ['G1', 1], fw: ['F3', 1], mf: ['F2', 1], df: ['F4', 1] },
  { handle: 'KanoKing',        gk: ['G2', 1], fw: ['F4', 1], mf: ['F11', 1], df: ['F6', 1] },
  { handle: 'KickMasterNG',    gk: ['G1', 2], fw: ['F1', 2], mf: ['F2', 1], df: ['F3', 1] },
  { handle: 'LagosLion',       gk: ['G1', 1], fw: ['F5', 2], mf: ['F2', 2], df: ['F6', 1] },
  { handle: 'DeltaForce',      gk: ['G3', 1], fw: ['F7', 2], mf: ['F11', 2], df: ['F3', 1] },
  { handle: 'OwerriOwls',      gk: ['G3', 2], fw: ['F7', 4], mf: ['F10', 3], df: ['F6', 3] },
  { handle: 'IbadanBlaze',     gk: ['G4', 2], fw: ['F12', 4], mf: ['F8', 3], df: ['F9', 3] },
  { handle: 'PortHarcourtPro', gk: ['G4', 4], fw: ['F15', 4], mf: ['F14', 4], df: ['F13', 4] }
]

let cache = null

export function opponentPool () {
  if (cache) return cache
  cache = ROSTER.map(r => {
    const team = buildTeam({
      gk: { def: byId[r.gk[0]], level: r.gk[1] },
      fw: { def: byId[r.fw[0]], level: r.fw[1] },
      mf: { def: byId[r.mf[0]], level: r.mf[1] },
      df: { def: byId[r.df[0]], level: r.df[1] }
    }, r.handle)
    return { handle: r.handle, team, power: powerOf(team) }
  })
  return cache
}

/* Two-stage search, PRD §11.3:
     stage 1 — sort candidates by |Power difference|  (cheap scalar)
     stage 2 — price the pairing in full; accept only if BOTH sides <= 2.50
   Returns the accepted opponent plus the candidates it walked past, so the
   matchmaking screen can show the real search instead of a fake spinner. */
export function findOpponent (playerTeam, opts = {}) {
  const myPower = opts.power !== undefined ? opts.power : powerOf(playerTeam)
  const ranked = opponentPool()
    .map(o => ({ ...o, gap: Math.abs(o.power - myPower) }))
    .sort((a, b) => a.gap - b.gap)

  const walked = []
  for (const cand of ranked) {
    const priced = priceMatch(playerTeam, cand.team)
    if (priced.matchable) return { opponent: cand, priced, walked }
    walked.push({ handle: cand.handle, power: cand.power, capOddsA: priced.capOddsA, capOddsB: priced.capOddsB })
  }
  // every queued candidate priced outside the cap -> platform takes the book
  const sys = systemOpponent(playerTeam, myPower)
  return { ...sys, walked, usedSystem: true, oddsCap: ODDS_CAP }
}

/* ---------- liquidity backstop (PRD §11.3) ----------
   When no queued opponent prices inside the cap, the player may take the
   platform's own side instead — mathematically identical to Instant Virtual
   (same model, same odds formula, platform carries the book). We build the
   System XI from the real card pool so the match script still has named
   cards to credit goals and saves to. */

const SYSTEM_SETS = [
  ['G4', 'F3', 'F2', 'F11'],
  ['G2', 'F14', 'F8', 'F9'],
  ['G1', 'F4', 'F11', 'F6'],
  ['G3', 'F10', 'F16', 'F13'],
  ['G3', 'F15', 'F16', 'F13']
]

let ladder = null
function systemLadder () {
  if (ladder) return ladder
  ladder = []
  for (const set of SYSTEM_SETS) {
    for (let level = 1; level <= 10; level++) {
      const team = buildTeam({
        gk: { def: byId[set[0]], level },
        fw: { def: byId[set[1]], level },
        mf: { def: byId[set[2]], level },
        df: { def: byId[set[3]], level }
      }, 'System XI')
      ladder.push({ team, power: powerOf(team) })
    }
  }
  ladder.sort((a, b) => a.power - b.power)
  return ladder
}

export function systemOpponent (playerTeam, myPower) {
  const target = myPower !== undefined ? myPower : powerOf(playerTeam)
  const ranked = systemLadder()
    .map(e => ({ ...e, gap: Math.abs(e.power - target) }))
    .sort((a, b) => a.gap - b.gap)

  for (const cand of ranked) {
    const priced = priceMatch(playerTeam, cand.team)
    if (priced.matchable) {
      return { opponent: { handle: 'System XI', team: cand.team, power: cand.power, isSystem: true }, priced }
    }
  }
  // last resort: mirror the player's own squad — q is exactly 0.5, so it can
  // never fail the cap
  const mirror = { ...playerTeam, name: 'System XI' }
  return {
    opponent: { handle: 'System XI', team: mirror, power: target, isSystem: true },
    priced: priceMatch(playerTeam, mirror)
  }
}
