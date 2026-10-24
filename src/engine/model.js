/* Match model — PRD Part III. Pure functions, no DOM.

   RED LINE (PRD §2.6, §10.3, guide §11): the probability object used to PRICE
   the match is the exact same object used to SAMPLE the result. priceMatch()
   returns both branches' full score distributions; drawResult() samples from
   that returned object and never recomputes anything. PK is a SINGLE sample.
   Payout is floored. */

import { buildCard } from './cards.js'

/* league constants — also the season parameter pack (PRD §6.6).
   avgAtk / avgDef are calibrated to the mean team strength of the card pool
   (see sim.js --calibrate); homeGoals - awayGoals is the home advantage. */
export const LEAGUE = {
  // calibrated to the card pool's mean team strength (npm run sim calibrate):
  // this is what "league average attack / defence" is defined to be, so the
  // baseline team is a genuinely average team and q_ref lands on 0.5.
  avgAtk: 5.98,
  avgDef: 5.89,
  // home advantage, PRD §9.1 values kept as-is
  homeGoals: 1.5,
  awayGoals: 1.1
}

export const MARGIN = 0.05
export const ODDS_CAP = 2.50
export const MAX_GOALS = 5          // Poisson truncated at 5, tail folded into P(5)
export const PK_CLAMP = [0.35, 0.65]

/* ---------- team aggregation (PRD §8) ---------- */

export function buildTeam (deckDefs, name = 'Team') {
  // deckDefs: { gk: {def, level}, fw: {...}, mf: {...}, df: {...} }
  const gk = buildCard(deckDefs.gk.def, deckDefs.gk.level)
  const fw = buildCard(deckDefs.fw.def, deckDefs.fw.level)
  const mf = buildCard(deckDefs.mf.def, deckDefs.mf.level)
  const df = buildCard(deckDefs.df.def, deckDefs.df.level)

  const homeAtk = 0.5 * fw.model.homeAtk + 0.3 * mf.model.homeAtk + 0.2 * df.model.homeAtk
  const awayAtk = 0.5 * fw.model.awayAtk + 0.3 * mf.model.awayAtk + 0.2 * df.model.awayAtk
  const homeDef = 0.4 * gk.model.homeDef + 0.3 * df.model.homeDef + 0.2 * mf.model.homeDef + 0.1 * fw.model.homeDef
  const awayDef = 0.4 * gk.model.awayDef + 0.3 * df.model.awayDef + 0.2 * mf.model.awayDef + 0.1 * fw.model.awayDef

  return {
    name,
    cards: { gk, fw, mf, df },
    outfield: [fw, mf, df],
    homeAtk, awayAtk, homeDef, awayDef,
    // PK inputs (PRD §10.1): mean attack of the three outfield cards vs keeper
    pkAtkHome: (fw.model.homeAtk + mf.model.homeAtk + df.model.homeAtk) / 3,
    pkAtkAway: (fw.model.awayAtk + mf.model.awayAtk + df.model.awayAtk) / 3,
    pkDefHome: gk.model.homeDef,
    pkDefAway: gk.model.awayDef
  }
}

/* the virtual team whose four values are all the league average (PRD §11.3) */
export function baselineTeam () {
  return {
    name: 'League Baseline',
    cards: null,
    outfield: [],
    homeAtk: LEAGUE.avgAtk, awayAtk: LEAGUE.avgAtk,
    homeDef: LEAGUE.avgDef, awayDef: LEAGUE.avgDef,
    pkAtkHome: LEAGUE.avgAtk, pkAtkAway: LEAGUE.avgAtk,
    pkDefHome: LEAGUE.avgDef, pkDefAway: LEAGUE.avgDef
  }
}

/* ---------- lambda, Poisson, 1X2 (PRD §9) ---------- */

export function lambdas (home, away, L = LEAGUE) {
  return {
    home: (home.homeAtk / L.avgAtk) * (L.avgDef / away.awayDef) * L.homeGoals,
    away: (away.awayAtk / L.avgAtk) * (L.avgDef / home.homeDef) * L.awayGoals
  }
}

export function poissonVector (lambda, maxGoals = MAX_GOALS) {
  const v = []
  let term = Math.exp(-lambda)
  let acc = 0
  for (let k = 0; k < maxGoals; k++) {
    v.push(term)
    acc += term
    term = (term * lambda) / (k + 1)
  }
  v.push(Math.max(0, 1 - acc))     // tail folded into the last bucket
  return v
}

/* full score matrix + 1X2, for one home/away assignment */
export function scoreDistribution (home, away, L = LEAGUE) {
  const lam = lambdas(home, away, L)
  const ph = poissonVector(lam.home)
  const pa = poissonVector(lam.away)
  const matrix = []
  let pHome = 0; let pDraw = 0; let pAway = 0
  for (let h = 0; h <= MAX_GOALS; h++) {
    matrix[h] = []
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = ph[h] * pa[a]
      matrix[h][a] = p
      if (h > a) pHome += p
      else if (h === a) pDraw += p
      else pAway += p
    }
  }
  return { lambda: lam, matrix, pHome, pDraw, pAway }
}

/* ---------- PK (PRD §10.1) ---------- */

export function pkHomeWinProb (home, away) {
  const sHome = home.pkAtkHome / away.pkDefAway
  const sAway = away.pkAtkAway / home.pkDefHome
  const raw = sHome / (sHome + sAway)
  return Math.min(PK_CLAMP[1], Math.max(PK_CLAMP[0], raw))
}

/* one home/away branch: distribution + PK + final win prob for the HOME side */
export function branch (home, away, L = LEAGUE) {
  const dist = scoreDistribution(home, away, L)
  const pPkHome = pkHomeWinProb(home, away)
  const qHome = dist.pHome + dist.pDraw * pPkHome
  return { ...dist, pPkHome, qHome }
}

/* ---------- pricing (PRD §11) ---------- */

export function floorTo (x, dp) {
  const f = Math.pow(10, dp)
  return Math.floor(x * f) / f
}

export function oddsFor (q) { return (1 - MARGIN) / q }
export function displayOdds (q) { return floorTo(oddsFor(q), 2) }   // PRD §11.2: floor to 2dp

/* Price a pairing BEFORE the toss. Returns the single probability object that
   both the odds and the eventual draw are taken from. */
export function priceMatch (teamA, teamB, L = LEAGUE) {
  const aHome = branch(teamA, teamB, L)      // branch where A is the home side
  const bHome = branch(teamB, teamA, L)      // branch where B is the home side

  const qA = 0.5 * aHome.qHome + 0.5 * (1 - bHome.qHome)
  const qB = 1 - qA

  return {
    teamA, teamB, league: L,
    branches: { aHome, bHome },
    qA, qB,
    oddsA: displayOdds(qA),
    oddsB: displayOdds(qB),
    exactOddsA: oddsFor(qA),
    exactOddsB: oddsFor(qB),
    matchable: displayOdds(qA) <= ODDS_CAP && displayOdds(qB) <= ODDS_CAP
  }
}

/* Power = q_ref, this team's pre-toss win probability against the league
   baseline team (PRD §11.3). Probability-scaled scalar, same unit as the
   matching condition. */
export function powerOf (team, L = LEAGUE) {
  return priceMatch(team, baselineTeam(), L).qA
}

/* Power -> 0-5 stars for the UI (platform convention, PRD §17.4) */
export function powerStars (q) {
  const pct = Math.max(0, Math.min(1, (q - 0.30) / 0.40))   // 0.30..0.70 -> 0..1
  return Math.round(pct * 10) / 2
}
export function powerScore (q) { return Math.round(q * 2000) }

/* ---------- sampling (PRD §10.3 — the red line) ---------- */

function pickFromMatrix (matrix, r) {
  let acc = 0
  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      acc += matrix[h][a]
      if (r <= acc) return { h, a }
    }
  }
  return { h: 0, a: 0 }
}

/* Draw the result from the SAME object that produced the odds.
   opts.forceDraw conditions the regular-time score on a tie (opts.minTieGoals
   excludes 0:0 so the match still has goals to show) — a demo PRESENTATION
   switch only. It still samples from the very same matrix, just restricted to
   the tie diagonal, and the PK is still one sample. The simulation harness
   never uses it, because conditioned samples say nothing about RTP. */
export function drawResult (priced, rng = Math.random, opts = {}) {
  // 1. coin toss decides home/away
  const aIsHome = rng() < 0.5
  const br = aIsHome ? priced.branches.aHome : priced.branches.bHome
  const home = aIsHome ? priced.teamA : priced.teamB
  const away = aIsHome ? priced.teamB : priced.teamA

  // 2. sample an exact scoreline from that branch's distribution
  let score
  if (opts.forceDraw) {
    // renormalise onto the tie diagonal of the SAME matrix
    const lo = opts.minTieGoals || 0
    const diag = []
    let sum = 0
    for (let k = 0; k <= MAX_GOALS; k++) {
      const p = k < lo ? 0 : br.matrix[k][k]
      diag.push(p); sum += p
    }
    let r = rng() * sum; let acc = 0; let k = lo
    for (; k <= MAX_GOALS; k++) { acc += diag[k]; if (r <= acc) break }
    k = Math.min(k, MAX_GOALS)
    score = { h: k, a: k }
  } else {
    score = pickFromMatrix(br.matrix, rng())
  }

  // 3. if level, ONE sample decides the PK winner (never round by round)
  let pk = null
  if (score.h === score.a) {
    pk = { homeWins: rng() < br.pPkHome, prob: br.pPkHome }
  }

  const homeWon = score.h > score.a || (pk && pk.homeWins)
  const winner = homeWon ? (aIsHome ? 'A' : 'B') : (aIsHome ? 'B' : 'A')

  return {
    aIsHome, home, away, homeScore: score.h, awayScore: score.a,
    pk, winner, wentToPk: !!pk,
    branchUsed: aIsHome ? 'aHome' : 'bHome'
  }
}

/* ---------- settlement (PRD §12) ---------- */

export function settle (priced, result, stakeA, stakeB) {
  const payoutA = result.winner === 'A' ? Math.floor(stakeA * priced.oddsA) : 0
  const payoutB = result.winner === 'B' ? Math.floor(stakeB * priced.oddsB) : 0
  return {
    payoutA, payoutB,
    netA: payoutA - stakeA,
    netB: payoutB - stakeB,
    platform: stakeA + stakeB - payoutA - payoutB
  }
}

/* ---------- rank scoring (PRD §6.4.1) ---------- */
export { rankWin, RANK_LOSS } from './economy.js'
