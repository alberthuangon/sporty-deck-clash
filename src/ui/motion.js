/* The UI animation layer — guide §10 step 6.

   These five animations are NOT the match's shape. A match is "decide, write
   the script, compile one timeline, then play it", which is what makes Skip
   safe and replay free. These are "the player did a thing, play a reaction":
   no script, nothing to compile ahead of time, nothing to keep seekable. Two
   idioms living side by side is correct here; pushing a tear animation
   through the match compiler would be dress-up, not architecture.

   What they DO need, and what the match already had, is a budget.

   The match has a 30s cap and a solver that distributes it. These five had
   nothing, and they are the ones on the repeated path: a match is watched once
   per bet, but a pack gets opened, a reward claimed and a card upgraded dozens
   of times in one session. An 8-second pack opening is harder to sit through
   than a 30-second match — and the failure mode is invisible in review,
   because each animation looks fine on its own. The fifth pack is what hurts.

   So the budget is not advice in this file. uiPlay() records what every
   animation actually compiled to, and `npm run layout` fails if one of them
   went over its cap, or runs longer than a second with no way out. */

import { reactive, ref } from 'vue'
import gsap from 'gsap'

/* Albert's approved caps, §3. A number here is a promise to the player, so
   nothing is allowed to exceed it — MotionLab's sliders top out at exactly
   these values, which is why the cap and the dial are separate objects. */
export const UI_BUDGET = Object.freeze({
  tear: 1.20,        // tap -> first card visible
  radar: 0.90,       // the radar shape morphing to next level
  payout: 1.10,      // the payout figure rolling
  rankUp: 1.40,      // the promotion burst
  flyIn: 0.60        // diamonds / shards flying to the wallet
})

/* What they actually spend. Live, so MotionLab retunes the rhythm without a
   reload, and every default sits UNDER its cap rather than on it: a budget
   spent to the last millisecond leaves no room to be wrong about. */
export const UI_TIME = reactive({
  tear: 0.92,
  radar: 0.72,
  payout: 0.80,
  rankUp: 1.22,
  flyIn: 0.46
})

/* Past this, an animation has to be interruptible — same semantics as the
   match's Skip: one tap and you are at the end state, not somewhere in the
   middle of it. */
export const INTERRUPT_OVER = 1.0

/* ---------- reduced motion ----------

   One switch for all five. CountUp's `animate` prop was the only motion
   control in the project and it is per-instance, which means nobody can turn
   the UI animations off in one move. Reads the OS preference and stays
   overridable: the gate wants motion ON so it can measure durations, and a
   presenter on stage may want it off. */
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
export const reduced = ref(!!(mq && mq.matches))
if (mq && mq.addEventListener) mq.addEventListener('change', e => { reduced.value = e.matches })
export function setReduced (v) { reduced.value = !!v }

/* ---------- the register ----------

   One row per animation NAME, holding its most recent play. The gate reads
   this: a budget nobody checks is a comment. */
const REGISTER = new Map()
let current = null

export function uiReport () {
  return [...REGISTER.values()].map(r => ({ ...r }))
}
export function uiResetReport () {
  REGISTER.clear()
}
export function uiRunning () { return current }
export function uiSkip () { if (current) current.skip() }

/* Build and play one UI animation.

   `build(tl)` adds beats to a paused timeline; everything else — the cap
   check, the interrupt surface, the register row — happens here so no call
   site can forget it. Unlike match/player.js this compiles at the moment of
   playing, so a fromTo's start state landing immediately is what we want
   rather than the bug it is over there. */
export function uiPlay (name, build, { interruptible = false, onEnd = null } = {}) {
  if (!(name in UI_BUDGET)) throw new Error(`uiPlay: no budget declared for "${name}"`)

  const tl = gsap.timeline({ paused: true })
  build(tl)

  const duration = +tl.duration().toFixed(3)
  const rec = {
    name,
    budget: UI_BUDGET[name],
    duration,
    needsExit: duration > INTERRUPT_OVER,
    interruptible: !!interruptible,
    skipped: false,
    done: false
  }
  REGISTER.set(name, rec)

  /* The way out, installed by the player rather than by every call site that
     might forget it. Transparent on purpose: this is an exit, not a scrim, so
     it must never hide what is underneath — and it is removed the moment the
     animation ends, which `npm run layout` checks. */
  let layer = null
  if (interruptible && typeof document !== 'undefined') {
    const host = document.querySelector('.phone')
    if (host) {
      layer = document.createElement('div')
      layer.className = 'ui-skip'
      layer.setAttribute('data-skip', name)
      layer.setAttribute('role', 'button')
      layer.setAttribute('aria-label', 'Skip animation')
      layer.addEventListener('click', () => api.skip())
      host.appendChild(layer)
    }
  }

  function finish () {
    if (rec.done) return
    rec.done = true
    if (layer) { layer.remove(); layer = null }
    if (current === api) current = null
    if (onEnd) onEnd()
  }

  const api = {
    name,
    timeline: tl,
    record: rec,
    /* suppressEvents: false, so onComplete fires and the end state is the
       real end state. A skip that leaves the last beat unrun is a skip to
       somewhere nobody designed. */
    skip () {
      if (rec.done) return
      rec.skipped = true
      tl.progress(1, false)
    },
    /* Not a skip: nobody is left to see the end state. Unmounting mid-flight
       without this leaves the interrupt surface over the whole frame, and
       every tap from then on lands on nothing. */
    cancel () {
      if (rec.done) return
      tl.kill()
      finish()
    }
  }

  tl.eventCallback('onComplete', finish)
  current = api

  if (reduced.value) { tl.progress(1, false); return api }
  tl.play(0)
  return api
}

/* Shipped, not dev-only: the layout gate runs a production build, and this is
   how it reads back what every animation cost. MotionLab ships for the same
   reason. */
if (typeof window !== 'undefined') {
  window.__motion = { report: uiReport, reset: uiResetReport, running: uiRunning, skip: uiSkip, budget: UI_BUDGET, time: UI_TIME, reduced }
}
