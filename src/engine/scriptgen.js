/* Script compiler — PRD §14.2, §15, §16 / guide §5.3.
   Input: a result core that has ALREADY been drawn. Output: a performance
   script. Nothing here touches probability used for pricing — the winner is an
   input, never an output (PRD §14.1: the animation does not decide anything). */

import { lambdas } from './model.js'

/* How long each演出 unit costs on screen, in seconds. Defaults mirror the
   stage's default beat lengths; the match screen passes the live values so
   retuning the motion automatically retunes the script's pacing. Kept as
   plain numbers here so engine/ stays free of any presentation import. */
export const DEFAULT_PACING = {
  goal: 3.52,          // first goal, cut-in included
  cutIn: 1.00,         // the part of `goal` that is the celebration
  cutInDecay: 0.15,    // each further goal gets a shorter one
  cutInMin: 0.50,
  save: 2.74, miss: 1.76, transition: 0.70,
  cap: 28,             // whole match, shootout included, with headroom under 30
  saveShare: 0.45      // share of wasted attacks that end as a save
}

/* The fourth goal of a match does not need the same celebration as the first,
   and in a 30-second match it cannot have it. */
export function cutInLength (index, p = DEFAULT_PACING) {
  return Math.max(p.cutInMin, p.cutIn - p.cutInDecay * index)
}

function goalsCost (goals, p) {
  let t = 0
  for (let i = 0; i < goals; i++) t += p.goal - p.cutIn + cutInLength(i, p)
  return t
}

function estimateLength (goals, waves, p, pkSeconds) {
  return goalsCost(goals, p) +
    waves * (p.saveShare * p.save + (1 - p.saveShare) * p.miss) +
    (goals + waves + 1) * p.transition +
    pkSeconds
}

/* Choose how many wasted attacks the match can afford: the most that still
   fits under the cap, given what the goals and the shootout already cost.
   A goal costs twice a miss and a shootout costs more again, so a 4-0 or a
   long shootout simply gets fewer wasted waves. */
export function planWaveCount (goals, pacing = DEFAULT_PACING, rng = Math.random, pkSeconds = 0) {
  let best = 1
  for (let n = 1; n <= 11; n++) {
    if (estimateLength(goals, n, pacing, pkSeconds) <= pacing.cap) best = n
    else break
  }
  // keep it alive, but never by going over budget
  if (best > 1 && rng() < 0.5) best -= 1
  return best
}

function pick (rng, arr) { return arr[Math.floor(rng() * arr.length)] }

function weightedPick (rng, items, weightOf) {
  const total = items.reduce((s, it) => s + weightOf(it), 0)
  let r = rng() * total
  for (const it of items) { r -= weightOf(it); if (r <= 0) return it }
  return items[items.length - 1]
}

/* attacking weight of an outfield card for "who makes the play" (PRD §15.3) */
function atkWeight (card, isHome) {
  return Math.max(0.1, isHome ? card.model.homeAtk : card.model.awayAtk)
}

const MISS_TYPES = ['SHOT_OFF', 'SHOT_POST', 'TACKLED']

/* ---------- regular time ---------- */

export function buildMatchScript (result, rng = Math.random, pacing = DEFAULT_PACING, pkSeconds = 0) {
  const { home, away, homeScore, awayScore } = result
  const lam = lambdas(home, away)

  const events = []

  /* goal minutes: 1'-90', nothing in the first 10 minutes, no two in the same
     minute, kept apart so the clock has room to breathe */
  const total = homeScore + awayScore
  const minutes = []
  let guard = 0
  while (minutes.length < total && guard++ < 500) {
    const m = 11 + Math.floor(rng() * 79)
    if (minutes.every(x => Math.abs(x - m) >= 6)) minutes.push(m)
  }
  minutes.sort((a, b) => a - b)

  const sides = []
  for (let i = 0; i < homeScore; i++) sides.push('HOME')
  for (let i = 0; i < awayScore; i++) sides.push('AWAY')
  for (let i = sides.length - 1; i > 0; i--) {     // shuffle so the order varies
    const j = Math.floor(rng() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]]
  }

  minutes.forEach((minute, i) => {
    const side = sides[i]
    const team = side === 'HOME' ? home : away
    const isHome = side === 'HOME'
    const scorer = weightedPick(rng, team.outfield, c => atkWeight(c, isHome))
    events.push({
      minute, type: 'GOAL', side,
      actor: scorer.id, actorName: scorer.name,
      keeper: (side === 'HOME' ? away : home).cards.gk.id,
      sfx: 'goal'
    })
  })

  /* Wasted attacks, budgeted against the target length (see planWaveCount).
     A shootout is coming out of the same 30s, so regular time gets less. */
  const waveCount = planWaveCount(total, pacing, rng, pkSeconds)
  const homeShare = lam.home / (lam.home + lam.away)
  const waveMinutes = []
  guard = 0
  while (waveMinutes.length < waveCount && guard++ < 2000) {
    const m = 3 + Math.floor(rng() * 86)
    const spacing = waveCount > 8 ? 3 : 5
    if (events.every(e => Math.abs(e.minute - m) >= 4) &&
        waveMinutes.every(x => Math.abs(x - m) >= spacing)) waveMinutes.push(m)
  }
  waveMinutes.forEach(minute => {
    const side = rng() < homeShare ? 'HOME' : 'AWAY'
    const team = side === 'HOME' ? home : away
    const foe = side === 'HOME' ? away : home
    const isHome = side === 'HOME'
    const actor = weightedPick(rng, team.outfield, c => atkWeight(c, isHome))
    const type = rng() < 0.45 ? 'SHOT_SAVE' : pick(rng, MISS_TYPES)
    events.push({
      minute, type, side,
      actor: actor.id, actorName: actor.name,
      keeper: foe.cards.gk.id,
      keeperName: foe.cards.gk.name,
      sfx: type === 'SHOT_SAVE' ? 'save' : 'shot'
    })
  })

  events.sort((a, b) => a.minute - b.minute)

  // half-time marker (PRD §15.1: compressed to a 2s transition)
  const firstHalf = events.filter(e => e.minute <= 45).length
  events.splice(firstHalf, 0, { minute: 45, type: 'HALF_TIME', sfx: 'whistle' })
  events.unshift({ minute: 0, type: 'KICK_OFF', sfx: 'whistle' })
  events.push({ minute: 90, type: 'FULL_TIME', sfx: 'whistle' })

  return events
}

/* ---------- penalty shootout (PRD §16) ---------- */

export const PK_TEMPLATES = [
  { id: 'comeback', label: 'The comeback', weight: 30 },
  { id: 'suddenDeath', label: 'Sudden death', weight: 30 },
  { id: 'keeperShow', label: 'The keeper show', weight: 20 },
  { id: 'straight', label: 'Clean sweep', weight: 12 },
  { id: 'keeperWinner', label: 'The keeper scores', weight: 8 }
]

/* Standard shootout bookkeeping: can the trailing side still catch up? */
function decided (hg, ag, round, kicksTakenThisRound, bestOf = 3) {
  if (round <= bestOf) {
    const homeLeft = bestOf - round + (kicksTakenThisRound < 1 ? 1 : 0)
    const awayLeft = bestOf - round + (kicksTakenThisRound < 2 ? 1 : 0)
    if (hg > ag + awayLeft) return 'HOME'
    if (ag > hg + homeLeft) return 'AWAY'
    return null
  }
  if (kicksTakenThisRound === 2 && hg !== ag) return hg > ag ? 'HOME' : 'AWAY'
  return null
}

function rollSequence (rng, pGoal) {
  const kicks = []
  let hg = 0; let ag = 0
  for (let round = 1; round <= 12; round++) {
    for (let slot = 0; slot < 2; slot++) {
      const side = slot === 0 ? 'HOME' : 'AWAY'
      const scored = rng() < pGoal
      kicks.push({ round, side, scored })
      if (scored) { if (side === 'HOME') hg++; else ag++ }
      const d = decided(hg, ag, round, slot + 1)
      if (d) return { kicks, hg, ag, rounds: round, winner: d }
    }
    const d = decided(hg, ag, round, 2)
    if (d) return { kicks, hg, ag, rounds: round, winner: d }
  }
  return null
}

function matchesTemplate (seq, tpl, winner) {
  const loser = winner === 'HOME' ? 'AWAY' : 'HOME'
  const lead = []
  let h = 0; let a = 0
  seq.kicks.forEach(k => {
    if (k.scored) { if (k.side === 'HOME') h++; else a++ }
    lead.push(h - a)
  })
  const loserLed = lead.some(d => (loser === 'HOME' ? d >= 2 : d <= -2))
  const winnerSaves = seq.kicks.filter(k => k.side === loser && !k.scored).length
  switch (tpl) {
    case 'comeback': return loserLed
    case 'suddenDeath': return seq.rounds > 3
    case 'keeperShow': return winnerSaves >= 2 && seq.rounds <= 3
    case 'straight': return seq.rounds <= 3 &&
      seq.kicks.filter(k => k.side === winner).every(k => k.scored)
    case 'keeperWinner': return seq.rounds > 3
    default: return true
  }
}

export function buildPenaltyScript (result, rng = Math.random) {
  const { home, away, pk } = result
  const winner = pk.homeWins ? 'HOME' : 'AWAY'

  const tpl = weightedPick(rng, PK_TEMPLATES, t => t.weight)

  /* rejection sampling: roll shootouts until one both ends with the
     predetermined winner and fits the chosen narrative skeleton */
  let seq = null
  for (let i = 0; i < 600 && !seq; i++) {
    const s = rollSequence(rng, 0.72)
    if (s && s.winner === winner && matchesTemplate(s, tpl.id, winner)) seq = s
  }
  if (!seq) {                       // fall back to narrative-free, winner still exact
    for (let i = 0; i < 2000 && !seq; i++) {
      const s = rollSequence(rng, 0.72)
      if (s && s.winner === winner) seq = s
    }
  }

  const order = ['fw', 'mf', 'df']
  const dirs = ['LEFT', 'CENTRE', 'RIGHT']
  const events = seq.kicks.map((k, i) => {
    const shootingTeam = k.side === 'HOME' ? home : away
    const keepingTeam = k.side === 'HOME' ? away : home
    const suddenDeath = k.round > 3
    const slot = order[(k.round - 1) % 3]
    const keeperTakesIt = suddenDeath && tpl.id === 'keeperWinner' &&
      k.side === winner && k.scored && k.round === seq.rounds
    const shooter = keeperTakesIt ? shootingTeam.cards.gk : shootingTeam.cards[slot]
    const dir = pick(rng, dirs)
    let dive = pick(rng, dirs)
    let outcome
    if (k.scored) {
      outcome = 'GOAL'
      if (dive === dir) dive = pick(rng, dirs.filter(d => d !== dir))
    } else if (rng() < 0.62) {
      outcome = 'SAVED'
      dive = dir
    } else {
      outcome = pick(rng, ['MISS', 'POST'])
      if (dive === dir) dive = pick(rng, dirs.filter(d => d !== dir))
    }
    return {
      index: i, round: k.round, side: k.side, suddenDeath,
      shooter: shooter.id, shooterName: shooter.name,
      keeper: keepingTeam.cards.gk.id, keeperName: keepingTeam.cards.gk.name,
      direction: dir, dive, outcome,
      decisive: i === seq.kicks.length - 1,
      sfx: outcome === 'GOAL' ? 'pk_goal' : 'pk_save'
    }
  })

  return {
    template: tpl,
    rounds: seq.rounds,
    homeGoals: seq.hg,
    awayGoals: seq.ag,
    winner,
    events
  }
}

/* Seconds a shootout of this many kicks will take. Mirrors stageModel's
   pkDuration; kept as plain numbers so engine/ imports nothing from match/. */
export const PK_COST = { kick: 0.55, suddenDeath: 0.42, showdown: 1.00, strike: 0.80, reveal: 0.60 }

export function pkSecondsFor (kickCount, c = PK_COST) {
  if (!kickCount) return 0
  let t = 0
  for (let i = 0; i < kickCount - 1; i++) t += i >= 5 ? c.suddenDeath : c.kick
  return t + c.showdown + c.strike + c.reveal
}

/* The shootout is compiled FIRST, because regular time has to be budgeted
   around however long it turns out to be — both come out of the same 30s. */
export function buildScript (result, rng = Math.random, pacing = DEFAULT_PACING) {
  const penalty = result.pk ? buildPenaltyScript(result, rng) : null
  const pkSeconds = penalty ? pkSecondsFor(penalty.events.length) : 0
  return {
    events: buildMatchScript(result, rng, pacing, pkSeconds),
    penalty,
    pkSeconds
  }
}
