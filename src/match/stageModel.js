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
  buildUp: 0.55,       // tokens surge, defenders drop
  pass: 0.30,          // one pass leg
  carry: 0.38,         // ball carrier drives into the box
  shot: 0.26,          // strike travelling to the target
  goalHang: 0.30,      // slow-motion beat on the ball crossing the line
  cutIn: 1.70,         // scorer card on screen
  saveCutIn: 1.15,     // keeper card on screen
  rebound: 0.34,
  reset: 0.42,         // formation easing back
  gap: 0.18,           // breath between waves
  clockRun: 2.00,      // clock fast-forwarding between waves (step 5 uses this)
  slowmo: 0.38         // timeScale during the goal impact, not a duration
}

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

/* Wall-clock length of a whole match, given how many of each event it holds.
   This is the number that has to land in PRD §15.1's 45-60 second window. */
export function matchDuration (counts, beat = BEAT) {
  const { goals = 0, saves = 0, misses = 0 } = counts
  const events = goals + saves + misses
  const waves = goals * waveDuration('GOAL', beat) +
    saves * waveDuration('SHOT_SAVE', beat) +
    misses * waveDuration('SHOT_OFF', beat)
  const transitions = Math.max(0, events + 1) * beat.clockRun   // kick-off .. full time
  return waves + transitions
}
