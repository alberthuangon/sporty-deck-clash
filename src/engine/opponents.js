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
    walked.push({ handle: cand.handle, power: cand.power, oddsA: priced.oddsA, oddsB: priced.oddsB })
  }
  return { opponent: null, priced: null, walked, oddsCap: ODDS_CAP }
}
