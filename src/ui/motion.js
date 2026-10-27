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

/* Albert's caps. A number here is a promise to the player, so nothing is
   allowed to exceed it — MotionLab's sliders top out at exactly these values,
   which is why the cap and the dial are separate objects.

   Revised after watching the clips: rankUp 1.40 -> 1.80 and flyIn 0.60 ->
   1.00, because the dials he asked for did not fit under the originals. The
   cap moving to meet the dial is the one direction this discipline cannot
   check for itself, so it is a decision, written down, rather than a drift. */
export const UI_BUDGET = Object.freeze({
  tear: 1.20,        // tap -> first card visible
  radar: 0.90,       // the radar shape morphing to next level
  payout: 1.10,      // the payout figure rolling
  rankUp: 1.80,      // the promotion burst
  flyIn: 1.00        // diamonds / shards flying to the wallet
})

/* What they actually spend — Albert's numbers, set by eye off the clips.
   Three of them now sit exactly ON their cap, which means the slider only
   moves downwards from here and any beat that quietly grows fails the gate
   on the next run. That is the discipline working, not a problem with it. */
export const UI_TIME = reactive({
  tear: 1.10,
  radar: 0.90,
  payout: 0.80,
  rankUp: 1.80,
  flyIn: 1.00
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
/* Everything still in the air. REGISTER holds one row per NAME, which is what
   the report and the camera want; but two flights of the same name can
   overlap — claim two missions quickly, or walk a pack of duplicates — and
   the one that gets superseded in the register is still running, still
   holding tokens. Cancelling needs all of them, not the latest of each. */
const LIVE = new Set()
let current = null

export function uiReport () {
  return [...REGISTER.values()].map(a => ({ ...a.record }))
}
export function uiResetReport () {
  REGISTER.clear()
}
/* The one PLAYING, or null the moment it lands. */
export function uiRunning () { return current }
/* The most recent play of a name, running or not — its timeline survives
   completion, so the gate's camera can seek back into an animation that has
   already finished and photograph the frame it wants. Waiting for a specific
   frame is not reliable under virtual time; naming it is. */
export function uiLast (name) { return REGISTER.get(name) || null }
export function uiSkip () { if (current) current.skip() }
/* Cancel anything still in the air. Nothing in the app needs this — nothing
   there pauses a UI animation — but the gate parks timelines mid-flight to
   photograph a frame, and a parked flight never reaches the onComplete that
   takes its tokens away. Without it one held frame leaked 12 tokens into
   every state measured after it. */
export function uiCancelAll () {
  ;[...LIVE].forEach(api => api.cancel())
  current = null
}

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
    /* what the dial asked for, next to what the timeline actually compiled
       to. They have to agree: a timeline that finishes early turns the dial
       into a decoration and MotionLab's slider into a lie, and the first
       tear draft did exactly that — 0.70s of animation on a 0.92s dial, so
       raising it past the cap did not even fail the budget check. */
    spend: UI_TIME[name],
    duration,
    needsExit: duration > INTERRUPT_OVER,
    interruptible: !!interruptible,
    skipped: false,
    done: false
  }
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
    LIVE.delete(api)
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
  REGISTER.set(name, api)
  LIVE.add(api)
  current = api

  if (reduced.value) { tl.progress(1, false); return api }
  tl.play(0)
  return api
}

/* Shipped, not dev-only: the layout gate runs a production build, and this is
   how it reads back what every animation cost. MotionLab ships for the same
   reason. */
if (typeof window !== 'undefined') {
  window.__motion = { report: uiReport, reset: uiResetReport, running: uiRunning, last: uiLast, skip: uiSkip, cancelAll: uiCancelAll, budget: UI_BUDGET, time: UI_TIME, reduced }
}
