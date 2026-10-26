/* Pitch geometry and choreography constants for the match stage.
   Pure data + pure helpers, no DOM, no GSAP — so the numbers that control the
   rhythm all live in one readable place and the motion lab can tune them. */

export const SLOTS = ['gk', 'df', 'mf', 'fw']

/* resting formation, percentages of the pitch box. Home attacks left -> right. */
export const FORMATION = {
  home: { gk: [7, 50], df: [25, 52], mf: [40, 30], fw: [53, 64] },
  away: { gk: [93, 50], df: [75, 48], mf: [60, 70], fw: [47, 36] }
}

/* how far each slot pushes up (attacking) or drops back (defending), in
   percentage points of pitch width. Signed for the home direction; mirrored
   for away. */
export const PUSH = { gk: 4, df: 15, mf: 19, fw: 15 }
export const DROP = { gk: 0, df: -7, mf: -11, fw: -16 }

/* Goal mouths */
export const GOAL = { home: [3, 50], away: [97, 50] }

/* Beat lengths in seconds. The motion lab writes to this object live, so
   retuning the rhythm never needs a reload. */
export const BEAT = {
  // Whole-match cap is 30s INCLUDING the shootout, so every beat is tight.
  buildUp: 0.40,       // tokens surge, defenders drop
  pass: 0.22,          // one pass leg
  carry: 0.30,         // ball carrier drives into the box
  shot: 0.22,          // strike travelling to the target
  goalHang: 0.22,      // slow-motion beat on the ball crossing the line
  cutIn: 1.00,         // scorer card on screen
  saveCutIn: 0.70,     // keeper card on screen
  rebound: 0.28,
  reset: 0.30,         // formation easing back
  gap: 0.10,           // breath between waves
  clockRun: 0.70,      // clock fast-forwarding between waves
  slowmo: 0.45,        // timeScale during the goal impact, not a duration

  // Shootout. Ordinary kicks are brisk; the kick that settles it gets the
  // three-beat showdown (PRD §16.4).
  pkKick: 0.55,        // an ordinary kick, start to resolution
  pkSuddenDeath: 0.42, // deep sudden death compresses further
  pkShowdown: 1.00,    // shooter card vs keeper card, held
  pkStrike: 0.80,      // the slow-motion strike
  pkReveal: 0.60,      // the answer

  idle: 2.6,           // ambient off-ball drift amplitude, px (not a duration)
  press: 0.45          // how far defenders slide into the ball's lane, 0-1
}

/* Penalty geometry, percentages of the goal-view box. The six placements and
   the three dive targets are what give `direction`/`height`/`dive` something
   to be read against — without them a dive is just a card tilting. */
export const PK_SPOT = { x: 50, y: 60 }
/* six placements inside a goal spanning y 17%-47% of the view */
export const PK_PLACEMENT = {
  LEFT: { HIGH: { x: 24, y: 24 }, LOW: { x: 22, y: 41 } },
  CENTRE: { HIGH: { x: 50, y: 22 }, LOW: { x: 50, y: 42 } },
  RIGHT: { HIGH: { x: 76, y: 24 }, LOW: { x: 78, y: 41 } }
}
export const PK_DIVE = { LEFT: { x: 25, y: 37 }, CENTRE: { x: 50, y: 35 }, RIGHT: { x: 75, y: 37 } }
export const PK_OFF = {
  LEFT: { HIGH: { x: 7, y: 8 }, LOW: { x: 5, y: 44 } },
  CENTRE: { HIGH: { x: 50, y: 4 }, LOW: { x: 50, y: 4 } },
  RIGHT: { HIGH: { x: 93, y: 8 }, LOW: { x: 95, y: 44 } }
}
/* the posts a ball can rattle, same coordinate space */
export const PK_POST = { LEFT: { x: 13, y: 33 }, CENTRE: { x: 50, y: 16 }, RIGHT: { x: 87, y: 33 } }

export function basePos (side, slot) {
  return FORMATION[side][slot]
}

/* Where a token stands during a wave. `attackingSide` owns the ball. */
export function wavePos (side, slot, attackingSide) {
  const [x, y] = FORMATION[side][slot]
  const dir = side === 'home' ? 1 : -1
  const delta = side === attackingSide ? PUSH[slot] : DROP[slot]
  return [clamp(x + dir * delta, 3, 97), y]
}

function clamp (v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

/* Off-ball shape. Defenders slide towards the lane the ball is in and
   attackers fan away from it, so the eight tokens read as a team reacting to
   play rather than eight markers sitting on their marks. */
export function reactedPos (side, slot, attackingSide, laneY, press) {
  const [x, y] = wavePos(side, slot, attackingSide)
  if (slot === 'gk') return [x, y + (laneY - 50) * 0.35 * press]
  const defending = side !== attackingSide
  const pull = defending ? press : -press * 0.45      // attackers drift off the lane
  return [x, clamp(y + (laneY - y) * pull, 12, 88)]
}

/* A small deterministic-ish spread so the eight tokens never move in lockstep. */
export function slotStagger (slot) {
  return { gk: 0.10, df: 0, mf: 0.05, fw: 0.08 }[slot] || 0
}

/* The pass chain for a wave: two team-mates feeding the named actor.
   Keeps the keeper out of open play and never passes to the same slot twice. */
export function passChain (actorSlot) {
  const outfield = ['df', 'mf', 'fw']
  const others = outfield.filter(s => s !== actorSlot)
  return [...others, actorSlot]
}

/* Where the ball ends up, by outcome. Returned in pitch percentages. */
export function shotTarget (outcome, attackingSide, seedish = 0.5) {
  const goal = attackingSide === 'home' ? GOAL.away : GOAL.home
  const beyond = attackingSide === 'home' ? 104 : -4
  const high = seedish < 0.5
  switch (outcome) {
    case 'GOAL': return [goal[0] + (attackingSide === 'home' ? 2 : -2), 50 + (high ? -11 : 11)]
    case 'SHOT_SAVE': return [goal[0] + (attackingSide === 'home' ? -1 : 1), 50 + (high ? -7 : 7)]
    case 'SHOT_POST': return [goal[0], 50 + (high ? -15 : 15)]
    case 'SHOT_OFF': return [beyond, 50 + (high ? -26 : 26)]
    case 'TACKLED': return [goal[0] + (attackingSide === 'home' ? -22 : 22), 50 + (high ? -8 : 8)]
    default: return goal
  }
}

/* Total duration of one wave, so the compiler can budget the 90 minutes.
   The goal strike runs in slow motion, so that stretch of wall-clock time is
   divided by the slowmo rate. */
export function waveDuration (outcome, beat = BEAT) {
  const base = beat.buildUp + beat.pass * 2 + beat.carry + beat.reset + beat.gap
  if (outcome === 'GOAL') {
    return base + (beat.shot + beat.goalHang) / beat.slowmo + beat.cutIn
  }
  if (outcome === 'SHOT_SAVE') return base + beat.shot + beat.saveCutIn + beat.rebound
  return base + beat.shot
}

/* Wall-clock length of a shootout. The decisive kick carries the showdown;
   everything before it is brisk, and deep sudden death is brisker still. */
export function pkDuration (kickCount, beat = BEAT) {
  if (!kickCount) return 0
  let total = 0
  for (let i = 0; i < kickCount - 1; i++) {
    total += i >= 5 ? beat.pkSuddenDeath : beat.pkKick
  }
  return total + beat.pkShowdown + beat.pkStrike + beat.pkReveal
}

/* Wall-clock length of a whole match, shootout included. This is the number
   that has to stay under the 30 second cap. */
export function matchDuration (counts, beat = BEAT) {
  const { goals = 0, saves = 0, misses = 0, pkKicks = 0 } = counts
  const events = goals + saves + misses
  // later goals get shorter celebrations, mirroring scriptgen's cutInLength
  let goalTime = 0
  for (let i = 0; i < goals; i++) {
    goalTime += waveDuration('GOAL', beat) - beat.cutIn + Math.max(0.50, beat.cutIn - 0.15 * i)
  }
  const waves = goalTime +
    saves * waveDuration('SHOT_SAVE', beat) +
    misses * waveDuration('SHOT_OFF', beat)
  const transitions = Math.max(0, events + 1) * beat.clockRun   // kick-off .. full time
  return waves + transitions + pkDuration(pkKicks, beat)
}
