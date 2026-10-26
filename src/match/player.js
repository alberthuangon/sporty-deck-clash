/* Timeline compiler — PRD §14.2, §15.2.
   Takes an already-decided script and an opaque `stage` API, returns GSAP
   timelines. No probability lives here: by the time anything in this file
   runs, the result is a fact (PRD §14.1).

   Every beat carries an `sfx` label through onStart, so the audio pass just
   maps labels to files without touching the choreography. */

import gsap from 'gsap'
import { SLOTS, basePos, wavePos, reactedPos, slotStagger, passChain, shotTarget, BEAT } from './stageModel.js'

function pos (el) { return { left: el[0] + '%', top: el[1] + '%' } }

/* ---------------------------------------------------------------- *
 * Ambient off-ball motion.
 * Runs on its own clock, independent of the match timeline, so players are
 * never completely still. It animates x/y (pixels) while the match timeline
 * animates left/top (percent) — the two compose instead of fighting.
 * ---------------------------------------------------------------- */
let idleTl = null

const IDLE_SPAN = 150          // seconds, longer than any match so it never loops

export function startIdle (stage, amp = BEAT.idle) {
  stopIdle()
  idleTl = gsap.timeline()
  stage.allTokens().forEach((el, i) => {
    const isKeeper = el.classList.contains('keeper')
    const ax = isKeeper ? amp * 0.5 : amp
    const ay = isKeeper ? amp * 1.3 : amp
    let at = (i * 0.37) % 1.6
    while (at < IDLE_SPAN) {
      const d = 0.9 + Math.random() * 1.4
      idleTl.to(el, {
        x: (Math.random() - 0.5) * ax * 2,
        y: (Math.random() - 0.5) * ay * 2,
        duration: d,
        ease: 'sine.inOut'
      }, at)
      at += d
    }
  })
  return idleTl
}

export function stopIdle () {
  if (idleTl) { idleTl.kill(); idleTl = null }
}

/* Seekable so a frame-exact recorder can advance the ambient motion in step
   with the match timeline instead of letting it run on wall-clock time. */
export function idleTimeline () { return idleTl }

/* Draw a fading trail along one leg of the ball's journey. The SVG uses a
   0..100 viewBox with preserveAspectRatio none, so pitch percentages are the
   path coordinates directly. */
function trail (tl, stage, from, to, at, duration) {
  const path = stage.trail()
  if (!path) return
  tl.call(() => {
    path.setAttribute('d', `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`)
  }, null, at)
  tl.fromTo(path, { opacity: .7 }, { opacity: 0, duration: duration + .22, ease: 'power2.out' }, at)
}

function sfx (tl, at, label, onSfx) {
  if (onSfx) tl.call(() => onSfx(label), null, at)
}

/* Move every token to its wave position (attackers surge, defenders drop),
   shaped around the lane the ball is in and staggered so the eight tokens do
   not move as one block. */
export function formationTo (tl, stage, attackingSide, at, beat, laneY = 50, press = 0) {
  for (const side of ['home', 'away']) {
    for (const slot of SLOTS) {
      const el = stage.token(side, slot)
      if (!el) continue
      tl.to(el, {
        ...pos(reactedPos(side, slot, attackingSide, laneY, press)),
        duration: beat.buildUp * (0.85 + Math.random() * 0.3),
        ease: 'power2.inOut'
      }, at + slotStagger(slot))
    }
  }
}

/* Mid-wave adjustment: the defending side squeezes towards the ball while the
   attack is being carried in. */
export function pressTo (tl, stage, attackingSide, at, duration, laneY, press) {
  const defSide = attackingSide === 'home' ? 'away' : 'home'
  for (const slot of SLOTS) {
    const el = stage.token(defSide, slot)
    if (!el) continue
    tl.to(el, {
      ...pos(reactedPos(defSide, slot, attackingSide, laneY, press)),
      duration, ease: 'power1.inOut'
    }, at + slotStagger(slot) * 0.5)
  }
  // the two attackers not on the ball keep making themselves available
  for (const slot of ['df', 'mf', 'fw']) {
    const el = stage.token(attackingSide, slot)
    if (!el) continue
    tl.to(el, {
      top: reactedPos(attackingSide, slot, attackingSide, laneY, press * 0.6)[1] + '%',
      duration, ease: 'sine.inOut'
    }, at + slotStagger(slot) * 0.5)
  }
}

export function formationRest (tl, stage, at, beat) {
  for (const side of ['home', 'away']) {
    for (const slot of SLOTS) {
      const el = stage.token(side, slot)
      if (!el) continue
      tl.to(el, {
        ...pos(basePos(side, slot)),
        duration: beat.reset * (0.85 + Math.random() * 0.35),
        ease: 'power2.inOut'
      }, at + slotStagger(slot) * 0.6)
    }
  }
}

/* Pulse the ring on the token currently on the ball. */
function highlight (tl, stage, side, slot, at) {
  const el = stage.token(side, slot)
  if (!el) return
  const ring = el.querySelector('.ring')
  tl.fromTo(ring, { opacity: .9, scale: .7 }, { opacity: 0, scale: 1.5, duration: .45, ease: 'power2.out' }, at)
  tl.fromTo(el, { scale: 1 }, { scale: 1.22, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out' }, at)
}

/* ---------------------------------------------------------------- *
 * One attack wave — the演出 unit of PRD §15.2.
 * opts: { side, actorSlot, outcome, keeperSlot, variance }
 * ---------------------------------------------------------------- */
export function buildWave (stage, opts, beat = BEAT, onSfx = null, onRate = null) {
  const { side, actorSlot = 'fw', outcome = 'SHOT_OFF', variance = 0.5 } = opts
  const defSide = side === 'home' ? 'away' : 'home'
  const tl = gsap.timeline()
  let t = 0

  // 1. build-up: shape shifts around the lane the move is in
  const chain = passChain(actorSlot)
  const laneY = wavePos(side, actorSlot, side)[1]
  formationTo(tl, stage, side, t, beat, laneY, beat.press * 0.45)
  const startPos = wavePos(side, chain[0], side)
  tl.set(stage.ball(), pos(startPos), t)
  highlight(tl, stage, side, chain[0], t + beat.buildUp * 0.55)
  sfx(tl, t, 'crowd_build', onSfx)
  t += beat.buildUp

  // 2. passes along the chain
  for (let i = 1; i < chain.length; i++) {
    const from = wavePos(side, chain[i - 1], side)
    const to = wavePos(side, chain[i], side)
    trail(tl, stage, from, to, t, beat.pass)
    tl.to(stage.ball(), { ...pos(to), duration: beat.pass, ease: 'power1.out' }, t)
    // a small lift so a pass reads differently from a carry
    tl.to(stage.ball(), { scale: 1.35, duration: beat.pass / 2, yoyo: true, repeat: 1, ease: 'sine.out' }, t)
    highlight(tl, stage, side, chain[i], t + beat.pass * 0.8)
    sfx(tl, t, 'pass', onSfx)
    t += beat.pass
  }

  // 3. carry into the box — the defending side squeezes in as it happens
  pressTo(tl, stage, side, t, beat.carry * 1.1, laneY, beat.press)
  const carryTo = wavePos(side, actorSlot, side)
  const toward = side === 'home' ? 13 : -13
  const carryEnd = [Math.max(5, Math.min(95, carryTo[0] + toward)), carryTo[1]]
  tl.to(stage.ball(), {
    left: Math.max(5, Math.min(95, carryTo[0] + toward)) + '%',
    top: carryTo[1] + '%',
    duration: beat.carry, ease: 'power1.inOut'
  }, t)
  tl.to(stage.token(side, actorSlot), {
    left: Math.max(5, Math.min(95, carryTo[0] + toward * 0.8)) + '%',
    duration: beat.carry, ease: 'power1.inOut'
  }, t)
  t += beat.carry

  // 4. the strike. A goal drops into slow motion just before contact and comes
  //    back to full speed once the ball is in (PRD §15.1 "關鍵事件變速放慢").
  const target = shotTarget(outcome, side, variance)
  const shotEase = outcome === 'GOAL' ? 'power3.in' : 'power2.out'
  if (outcome === 'GOAL' && onRate) {
    tl.call(() => onRate(beat.slowmo), null, Math.max(0, t - 0.06))
  }
  trail(tl, stage, carryEnd, target, t, beat.shot)
  tl.to(stage.ball(), { ...pos(target), duration: beat.shot, ease: shotEase }, t)
  tl.to(stage.ball(), { scale: 1.5, duration: beat.shot * .5, yoyo: true, repeat: 1 }, t)
  sfx(tl, t, outcome === 'GOAL' ? 'shot_hard' : 'shot', onSfx)

  // keeper lunges on anything on target
  if (outcome === 'SHOT_SAVE' || outcome === 'GOAL') {
    const gk = stage.token(defSide, 'gk')
    const dy = target[1] < 50 ? -13 : 13
    tl.to(gk, { top: (50 + dy) + '%', scale: 1.15, duration: beat.shot * 0.9, ease: 'power2.out' }, t + beat.shot * 0.1)
    tl.to(gk, { scale: 1, duration: .3 }, t + beat.shot + .1)
  }
  // everyone reacts to the strike with a small flinch towards the ball
  for (const slot of SLOTS) {
    const el = stage.token(defSide, slot)
    if (el && slot !== 'gk') {
      tl.to(el, { scale: 1.08, duration: .1, yoyo: true, repeat: 1, ease: 'power1.out' }, t + beat.shot * 0.5)
    }
  }
  t += beat.shot

  // 5. resolution
  if (outcome === 'GOAL') {
    sfx(tl, t, 'goal', onSfx)
    tl.to(stage.flash(), { opacity: .55, duration: .07 }, t)
    tl.to(stage.flash(), { opacity: 0, duration: .32 }, t + .07)
    tl.set(stage.shock(), { ...pos(target) }, t)
    tl.fromTo(stage.shock(), { opacity: .9, scale: .3 },
      { opacity: 0, scale: 3.4, duration: .52, ease: 'power2.out' }, t)
    t += beat.goalHang
    if (onRate) tl.call(() => onRate(1), null, t)
    // ball back to the centre spot for the restart, otherwise it sits in the
    // net and the next wave starts from nowhere
    tl.to(stage.ball(), { left: '50%', top: '50%', duration: beat.reset, ease: 'power2.inOut' }, t)
  } else if (outcome === 'SHOT_SAVE') {
    sfx(tl, t, 'save', onSfx)
    const gk = stage.token(defSide, 'gk')
    tl.to(gk, { scale: 1.3, duration: .1, yoyo: true, repeat: 1 }, t)
    const away = side === 'home' ? -18 : 18
    tl.to(stage.ball(), {
      left: (target[0] + away) + '%', top: (target[1] + (target[1] < 50 ? 16 : -16)) + '%',
      duration: beat.rebound, ease: 'power2.out'
    }, t + .08)
    t += beat.rebound
  } else if (outcome === 'SHOT_POST') {
    sfx(tl, t, 'post', onSfx)
    const away = side === 'home' ? -20 : 20
    tl.to(stage.ball(), { left: (target[0] + away) + '%', top: '22%', duration: .36, ease: 'power2.out' }, t)
    t += .3
  }

  // 6. shape eases back
  formationRest(tl, stage, t, beat)
  const gk = stage.token(defSide, 'gk')
  tl.to(gk, { ...pos(basePos(defSide, 'gk')), scale: 1, duration: beat.reset, ease: 'power2.inOut' }, t)
  t += beat.reset + beat.gap

  return tl
}

/* ---------------------------------------------------------------- *
 * Goal cut-in — the scorer's named moment (PRD §2.8, §15.2)
 * ---------------------------------------------------------------- */
export function buildGoalCutIn (stage, { card, scoreSide, scoreHome, scoreAway, subtitle },
  beat = BEAT, onSfx = null) {
  const ci = stage.cutin()
  const tl = gsap.timeline()

  tl.call(() => stage.setCutIn(card, 'GOAL!', subtitle || `${card.name} scores`))
  tl.set(ci.root, { visibility: 'visible' })
  tl.fromTo(ci.bg, { opacity: 0 }, { opacity: 1, duration: .16, ease: 'power2.out' }, 0)
  tl.fromTo(ci.streaks, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: .5, ease: 'power2.out' }, 0)
  tl.to(ci.streaks, { x: 40, duration: beat.cutIn, ease: 'none' }, .1)

  const cardEl = ci.body.querySelector('.ci-card')
  tl.fromTo(cardEl,
    { x: -110, opacity: 0, rotate: -9, scale: .82 },
    { x: 0, opacity: 1, rotate: 0, scale: 1, duration: .42, ease: 'back.out(1.5)' }, .04)

  tl.fromTo(ci.text,
    { scale: 2.1, opacity: 0, letterSpacing: '0.3em' },
    { scale: 1, opacity: 1, letterSpacing: '0.04em', duration: .34, ease: 'back.out(2.2)' }, .2)
  sfx(tl, .2, 'goal_shout', onSfx)

  // scoreboard digit punches at the peak of the cut-in
  tl.call(() => stage.setScore(scoreHome, scoreAway), null, .36)
  const digit = stage.scoreEl(scoreSide)
  if (digit) {
    tl.fromTo(digit, { scale: 1.9, color: '#33EA6A' },
      { scale: 1, color: '#ffffff', duration: .5, ease: 'back.out(2)' }, .36)
  }

  tl.to([ci.bg, ci.body, ci.streaks], { opacity: 0, duration: .26, ease: 'power2.in' }, beat.cutIn)
  tl.set(ci.root, { visibility: 'hidden' })
  tl.set([ci.bg, ci.body, ci.streaks], { opacity: 1 })
  return tl
}

/* Keeper's named moment — shorter, cooler palette */
export function buildSaveCutIn (stage, { card, subtitle }, beat = BEAT, onSfx = null) {
  const ci = stage.cutin()
  const tl = gsap.timeline()
  tl.call(() => stage.setCutIn(card, 'SAVED', subtitle || `${card.name} keeps it out`))
  tl.set(ci.root, { visibility: 'visible' })
  tl.fromTo(ci.bg, { opacity: 0 }, { opacity: 1, duration: .14 }, 0)
  const cardEl = ci.body.querySelector('.ci-card')
  tl.fromTo(cardEl, { y: 70, opacity: 0, scale: .9 },
    { y: 0, opacity: 1, scale: 1, duration: .34, ease: 'back.out(1.4)' }, .03)
  tl.fromTo(ci.text, { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: .26, ease: 'back.out(2)' }, .14)
  sfx(tl, .14, 'save_shout', onSfx)
  tl.to([ci.bg, ci.body], { opacity: 0, duration: .22, ease: 'power2.in' }, beat.saveCutIn)
  tl.set(ci.root, { visibility: 'hidden' })
  tl.set([ci.bg, ci.body], { opacity: 1 })
  return tl
}

/* Put every element back where it started, for replays. */
export function resetStage (stage) {
  for (const side of ['home', 'away']) {
    for (const slot of SLOTS) {
      const el = stage.token(side, slot)
      // xPercent/yPercent carries the centring, which frees x/y for the
      // ambient drift and leaves left/top for the match timeline
      if (el) gsap.set(el, { ...pos(basePos(side, slot)), scale: 1, xPercent: -50, yPercent: -50, x: 0, y: 0 })
      const ring = el && el.querySelector('.ring')
      if (ring) gsap.set(ring, { opacity: 0, scale: .7 })
    }
  }
  gsap.set(stage.ball(), { left: '50%', top: '50%', scale: 1, xPercent: -50, yPercent: -50, x: 0, y: 0 })
  const tr = stage.trail()
  if (tr) { gsap.set(tr, { opacity: 0 }); tr.setAttribute('d', '') }
  gsap.set(stage.flash(), { opacity: 0 })
  gsap.set(stage.shock(), { opacity: 0, scale: 1 })
  for (const side of ['home', 'away']) {
    const d = stage.scoreEl(side)
    if (d) gsap.set(d, { clearProps: 'all' })
  }
  const pk = stage.pk && stage.pk()
  if (pk && pk.root) {
    gsap.set(pk.root, { visibility: 'hidden' })
    gsap.set([pk.bg, pk.vig, pk.head, pk.stage, pk.stamp].filter(Boolean), { clearProps: 'all' })
  }
  const ci = stage.cutin()
  gsap.set(ci.root, { visibility: 'hidden' })
  gsap.set([ci.bg, ci.body, ci.streaks], { opacity: 1, x: 0, y: 0 })
  const card = ci.body && ci.body.querySelector('.ci-card')
  if (card) gsap.set(card, { clearProps: 'all' })
  if (ci.text) gsap.set(ci.text, { clearProps: 'all' })
}

/* ---------------------------------------------------------------- *
 * Penalty showdown — the kick that settles it (PRD §16.4).
 *
 * Three beats, no freeze: hold, stretch, reveal. All of the tension sits
 * BEFORE contact, which is what makes it honest — at the moment the crowd
 * holds its breath the picture itself does not yet know the answer, so a goal
 * and a save are pre-rolled identically and the演出 leaks nothing.
 *
 * opts: { shooter, keeper, outcome, direction, dive, label, board, decisive }
 * ---------------------------------------------------------------- */
export function buildPkShowdown (stage, opts, beat = BEAT, onSfx = null, onRate = null) {
  const { shooter, keeper, outcome = 'GOAL', direction = 'CENTRE', dive = 'LEFT', label = '',
    board, boardAfter, standalone = true } = opts
  const pk = stage.pk()
  const tl = gsap.timeline()
  const scored = outcome === 'GOAL'
  const guessedRight = dive === direction

  tl.call(() => { stage.setPk(shooter, keeper, label, board); stage.setPkStamp('') })
  tl.set(pk.root, { visibility: 'visible' })
  tl.set(pk.stamp, { opacity: 0, scale: 1.8 })
  tl.set(pk.net, { opacity: 0 })
  tl.set(pk.ball, { left: '30%', y: 0, scale: 1, opacity: 1 })

  /* ---- beat 1: the hold ---------------------------------------- */
  if (standalone) {
    tl.fromTo(pk.bg, { opacity: 0 }, { opacity: 1, duration: .20, ease: 'power2.out' }, 0)
  }
  tl.fromTo(pk.head, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: .26 }, .06)
  // cards close in from both edges
  tl.fromTo(pk.shooter, { x: -150, opacity: 0 }, { x: 0, opacity: 1, duration: .34, ease: 'power3.out' }, .04)
  tl.fromTo(pk.keeper, { x: 150, opacity: 0 }, { x: 0, opacity: 1, duration: .34, ease: 'power3.out' }, .04)
  tl.fromTo(pk.ball, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .24, ease: 'back.out(2)' }, .22)
  // camera pushes in
  tl.fromTo(pk.stage, { scale: 1 }, { scale: 1.06, duration: beat.pkShowdown, ease: 'power1.inOut' }, .1)
  // vignette breathes at roughly 75bpm — two beats before the kick
  tl.fromTo(pk.vig, { opacity: .55 },
    { opacity: 1, duration: beat.pkShowdown / 2.4, ease: 'sine.inOut', yoyo: true, repeat: 1 }, .12)
  // the keeper shifts his weight: he is guessing, and you can see him guess
  tl.to(pk.keeper, { x: 7, duration: beat.pkShowdown / 3, ease: 'sine.inOut' }, .38)
  tl.to(pk.keeper, { x: -6, duration: beat.pkShowdown / 3, ease: 'sine.inOut' }, .38 + beat.pkShowdown / 3)
  sfx(tl, .12, 'pk_heartbeat', onSfx)

  let t = beat.pkShowdown

  /* ---- beat 2: the strike -------------------------------------- */
  if (onRate) tl.call(() => onRate(0.55), null, t)
  tl.to(pk.shooter, { x: 14, duration: .10, yoyo: true, repeat: 1, ease: 'power2.out' }, t)
  sfx(tl, t, 'pk_strike', onSfx)
  // the keeper commits — same movement whether he is right or wrong
  const diveX = dive === 'LEFT' ? -16 : dive === 'RIGHT' ? 16 : 0
  tl.to(pk.keeper, { x: diveX, y: diveX === 0 ? -6 : 0, rotate: diveX * 0.35, duration: beat.pkStrike * .8, ease: 'power2.out' }, t + .04)
  // ball travels, stretched
  tl.to(pk.ball, {
    left: guessedRight && !scored ? '74%' : '92%',
    y: direction === 'LEFT' ? -34 : direction === 'RIGHT' ? 34 : 0,
    duration: beat.pkStrike, ease: 'power2.in'
  }, t)
  tl.to(pk.ball, { scale: 1.5, duration: beat.pkStrike * .5, yoyo: true, repeat: 1 }, t)
  t += beat.pkStrike

  /* ---- beat 3: the reveal -------------------------------------- */
  if (onRate) tl.call(() => onRate(1), null, t)
  // the pip for THIS kick only lights once the ball has arrived — lighting it
  // during the hold would give the answer away
  if (boardAfter) tl.call(() => stage.setPk(shooter, keeper, label, boardAfter), null, t)
  if (scored) {
    tl.fromTo(pk.net, { opacity: 0, scaleX: .9 },
      { opacity: 1, scaleX: 1, duration: .18, ease: 'power2.out' }, t)
    tl.to(pk.net, { scaleY: 1.1, duration: .14, yoyo: true, repeat: 1, ease: 'power2.out' }, t + .1)
    tl.to(pk.vig, { opacity: .25, duration: .22 }, t)
    tl.call(() => stage.setPkStamp(guessedRight ? 'GOAL' : 'GOAL'), null, t)
    tl.fromTo(pk.stamp, { opacity: 0, scale: 1.9 },
      { opacity: 1, scale: 1, duration: .30, ease: 'back.out(2.2)' }, t + .04)
    sfx(tl, t, 'pk_goal', onSfx)
  } else {
    // keeper gets there: he punches, the ball ricochets away
    tl.to(pk.keeper, { scale: 1.16, duration: .10, yoyo: true, repeat: 1, ease: 'power2.out' }, t)
    tl.to(pk.ball, { left: '56%', y: -58, scale: .8, duration: .34, ease: 'power2.out' }, t + .04)
    tl.call(() => stage.setPkStamp(outcome === 'SAVED' ? 'SAVED' : outcome === 'POST' ? 'POST!' : 'MISSED'), null, t)
    tl.fromTo(pk.stamp, { opacity: 0, scale: 1.7, color: '#9CA0AB' },
      { opacity: 1, scale: 1, duration: .28, ease: 'back.out(2)' }, t + .04)
    sfx(tl, t, 'pk_save', onSfx)
  }
  t += beat.pkReveal

  if (standalone) {
    tl.to([pk.bg, pk.vig, pk.head, pk.stage, pk.stamp], { opacity: 0, duration: .24, ease: 'power2.in' }, t)
    tl.set(pk.root, { visibility: 'hidden' })
    tl.set([pk.bg, pk.vig, pk.head, pk.stage], { opacity: 1 })
    tl.set([pk.shooter, pk.keeper, pk.ball], { clearProps: 'all' })
  } else {
    tl.to(pk.stamp, { opacity: 0, duration: .2 }, t)
    tl.set([pk.shooter, pk.keeper], { x: 0, y: 0, rotate: 0, scale: 1 })
  }
  return tl
}

/* An ordinary shootout kick: no hold, no camera move. The overlay is already
   up, so this is just a card swap, a quick strike and a pip lighting up. */
export function buildPkKick (stage, opts, beat = BEAT, onSfx = null) {
  const { shooter, keeper, outcome = 'GOAL', direction = 'CENTRE', dive = 'LEFT', label,
    board, boardAfter, duration = beat.pkKick } = opts
  const pk = stage.pk()
  const tl = gsap.timeline()
  const scored = outcome === 'GOAL'
  const guessedRight = dive === direction

  tl.call(() => { stage.setPk(shooter, keeper, label, board); stage.setPkStamp('') })
  tl.set(pk.ball, { left: '30%', y: 0, scale: 1, opacity: 1 })
  tl.set(pk.net, { opacity: 0 })
  tl.fromTo([pk.shooter, pk.keeper], { opacity: .25 }, { opacity: 1, duration: duration * .22 }, 0)

  const strike = duration * .52
  const diveX = dive === 'LEFT' ? -12 : dive === 'RIGHT' ? 12 : 0
  tl.to(pk.keeper, { x: diveX, rotate: diveX * .3, duration: strike, ease: 'power2.out' }, duration * .22)
  tl.to(pk.ball, {
    left: guessedRight && !scored ? '74%' : '92%',
    y: direction === 'LEFT' ? -30 : direction === 'RIGHT' ? 30 : 0,
    duration: strike, ease: 'power2.in'
  }, duration * .22)
  sfx(tl, duration * .22, scored ? 'pk_goal' : 'pk_save', onSfx)

  const at = duration * .22 + strike
  if (boardAfter) tl.call(() => stage.setPk(shooter, keeper, label, boardAfter), null, at)
  if (scored) {
    tl.fromTo(pk.net, { opacity: 0 }, { opacity: 1, duration: .12 }, at)
  } else {
    tl.to(pk.keeper, { scale: 1.12, duration: .08, yoyo: true, repeat: 1 }, at)
    tl.to(pk.ball, { left: '56%', y: -40, scale: .8, duration: .2, ease: 'power2.out' }, at)
  }
  tl.to(pk.keeper, { x: 0, rotate: 0, duration: duration * .2 }, at + .1)
  return tl
}

/* ---------------------------------------------------------------- *
 * The compiler (PRD §14.2).
 *
 * A whole decided script becomes ONE GSAP timeline, built before a single
 * frame plays. That is what makes Skip safe: the result is already a fact, so
 * jumping to the end cannot change anything.
 * ---------------------------------------------------------------- */

const MATCH_CAP = 30            // seconds, whole match including the shootout

function slotOf (team, cardId) {
  for (const slot of SLOTS) if (team.cards[slot].id === cardId) return slot
  return 'fw'
}

function pkBoardUpTo (events, index) {
  const board = { HOME: [], AWAY: [] }
  for (let i = 0; i <= index; i++) {
    const e = events[i]
    board[e.side].push(e.outcome === 'GOAL' ? 'goal' : 'miss')
  }
  return board
}

/* Run the match clock from one minute to the next. */
function clockRun (tl, stage, from, to, at, duration, label) {
  const holder = { m: from }
  tl.to(holder, {
    m: to, duration, ease: 'none',
    onUpdate: () => stage.setClock(Math.round(holder.m) + "'")
  }, at)
  if (label !== undefined) tl.call(() => stage.setPhase(label), null, at)
}

export function compileMatch (stage, script, result, beat = BEAT, cbs = {}) {
  const { onSfx = null, onRate = null, onEnd = null, onEvent = null } = cbs
  const announce = (ev, at) => { if (onEvent) master.call(() => onEvent(ev), null, at) }
  const home = result.home
  const away = result.away
  const master = gsap.timeline({ paused: true, onComplete: () => onEnd && onEnd() })

  master.call(() => {
    stage.setScore(0, 0)
    stage.setClock("0'")
    stage.setPhase('')
  })

  let t = 0
  let prevMinute = 0
  let h = 0
  let a = 0
  let goalIndex = 0
  /* Slow motion is applied at RUNTIME via timeScale, so it stretches wall-clock
     time without lengthening the timeline. The cap has to be checked against
     wall time, not master.duration(), or every goal silently overruns it. */
  const slowmoExtra = (beat.shot + beat.goalHang) * (1 / beat.slowmo - 1)

  for (const ev of script.events) {
    if (ev.type === 'KICK_OFF') {
      master.call(() => stage.setPhase('KICK OFF'), null, t)
      sfxAt(master, t, 'whistle', onSfx)
      announce(ev, t)
      t += beat.gap
      continue
    }
    if (ev.type === 'HALF_TIME') {
      clockRun(master, stage, prevMinute, 45, t, beat.clockRun, 'HALF TIME')
      sfxAt(master, t, 'whistle', onSfx)
      announce(ev, t)
      prevMinute = 45
      t += beat.clockRun
      continue
    }
    if (ev.type === 'FULL_TIME') {
      clockRun(master, stage, prevMinute, 90, t, beat.clockRun, 'FULL TIME')
      sfxAt(master, t, 'whistle', onSfx)
      announce(ev, t)
      prevMinute = 90
      t += beat.clockRun
      continue
    }

    // run the clock up to this event, then play it
    clockRun(master, stage, prevMinute, ev.minute, t, beat.clockRun, '')
    prevMinute = ev.minute
    t += beat.clockRun

    const side = ev.side === 'HOME' ? 'home' : 'away'
    const team = side === 'home' ? home : away
    const actorSlot = slotOf(team, ev.actor)
    const wave = buildWave(stage, {
      side, actorSlot, outcome: ev.type, variance: (ev.minute % 7) / 7
    }, beat, onSfx, onRate)
    master.add(wave, t)

    // the feed line lands with the moment, never before it
    const resolveAt = t + wave.duration() - (beat.reset + beat.gap)

    if (ev.type === 'GOAL') {
      if (ev.side === 'HOME') h++; else a++
      const cutLen = Math.max(0.50, beat.cutIn - 0.15 * goalIndex)
      goalIndex++
      announce(ev, resolveAt)
      master.add(buildGoalCutIn(stage, {
        card: team.cards[actorSlot], scoreSide: side,
        scoreHome: h, scoreAway: a,
        subtitle: `${ev.actorName} · ${ev.minute}'`
      }, { ...beat, cutIn: cutLen }, onSfx), t + wave.duration() - (beat.reset + beat.gap))
      t += wave.duration() + cutLen + 0.26 - (beat.reset + beat.gap)
    } else if (ev.type === 'SHOT_SAVE') {
      announce(ev, resolveAt)
      const keeperTeam = side === 'home' ? away : home
      master.add(buildSaveCutIn(stage, { card: keeperTeam.cards.gk }, beat, onSfx),
        t + wave.duration() - (beat.reset + beat.gap))
      t += wave.duration() + beat.saveCutIn + 0.22 - (beat.reset + beat.gap)
    } else {
      announce(ev, resolveAt)
      t += wave.duration()
    }
  }

  /* ---- the shootout -------------------------------------------- */
  if (script.penalty) {
    const pk = stage.pk()
    const evs = script.penalty.events
    master.call(() => stage.setPhase('PENALTIES'), null, t)
    master.set(pk.root, { visibility: 'visible' }, t)
    master.fromTo(pk.bg, { opacity: 0 }, { opacity: 1, duration: .28, ease: 'power2.out' }, t)
    master.fromTo(pk.vig, { opacity: 0 }, { opacity: .8, duration: .28 }, t)
    t += .28

    evs.forEach((e, i) => {
      const shootTeam = e.side === 'HOME' ? home : away
      const keepTeam = e.side === 'HOME' ? away : home
      const shooterSlot = slotOf(shootTeam, e.shooter)
      const opts = {
        shooter: shootTeam.cards[shooterSlot],
        keeper: keepTeam.cards.gk,
        outcome: e.outcome, direction: e.direction, dive: e.dive,
        label: e.suddenDeath ? `ROUND ${e.round} · SUDDEN DEATH` : `ROUND ${e.round}`,
        board: pkBoardUpTo(evs, i - 1),       // state BEFORE this kick
        boardAfter: pkBoardUpTo(evs, i),       // lit when the ball arrives
        standalone: false
      }
      if (e.decisive) {
        const sd = buildPkShowdown(stage, opts, beat, onSfx, onRate)
        master.add(sd, t)
        announce(e, t + beat.pkShowdown + beat.pkStrike)
        t += sd.duration()
      } else {
        const dur = i >= 5 ? beat.pkSuddenDeath : beat.pkKick
        const k = buildPkKick(stage, { ...opts, duration: dur }, beat, onSfx)
        master.add(k, t)
        announce(e, t + dur * 0.74)
        t += dur
      }
    })

    master.to([pk.bg, pk.vig, pk.head, pk.stage], { opacity: 0, duration: .26 }, t)
    master.set(pk.root, { visibility: 'hidden' }, t + .26)
    t += .26
  }

  /* 30-second cap is hard. The script generator gets within it 98% of the
     time; for the high-scoring draws that cannot fit, compress the whole
     timeline rather than cutting a beat out of the drama. */
  const raw = master.duration()
  const expected = raw + goalIndex * slowmoExtra
  if (expected > MATCH_CAP) master.timeScale(expected / MATCH_CAP)

  return {
    timeline: master,
    rawDuration: raw,
    expectedDuration: expected,            // what the clock on the wall will say
    playedDuration: Math.min(expected, MATCH_CAP),
    capScale: master.timeScale()
  }
}

function sfxAt (tl, at, label, onSfx) {
  if (onSfx) tl.call(() => onSfx(label), null, at)
}
