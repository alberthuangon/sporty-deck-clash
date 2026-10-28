/* Harness for `npm run layout` — the whole-app half.

   Mounts the real App.vue, so the real TopBar, TabBar and GSAP screen
   transition are all in the picture, then walks every case in cases.js and
   reports what it measured. The assertions live in run.mjs; this file only
   looks.

   Three things here exist only because of headless Chrome, and all three
   silently produced a green-looking lie before they were handled:
     - rAF is dead under --virtual-time-budget (see the shim in screens.html)
     - --window-size is ignored      (see the pinned frame in screens.html)
     - mode="out-in" means the OUTGOING screen is briefly the only .screen in
       the DOM, fully settled (see settle())
     - gsap's lag smoothing clamps any frame longer than 500ms down to 33ms,
       and under virtual time every frame IS longer than that: the rank-up
       burst advanced 0.31s while the harness waited 1.8s, so a state that had
       finished animating measured mid-flight and the "a skip lands on the end
       state" group failed against the wrong reference. Off here; it exists to
       protect real users from a stalled tab, and there is no user. */
import { createApp, nextTick } from 'vue'
import gsap from 'gsap'
import App from '../../src/App.vue'
import '../../src/styles/tokens.css'
import '../../src/styles/base.css'
import { store, go } from '../../src/store.js'
import { CASES } from './cases.js'
import { measure } from './measure.js'
import { uiResetReport, uiReport, uiCancelAll, UI_BUDGET } from '../../src/ui/motion.js'

gsap.ticker.lagSmoothing(0)

/* THE DRIFT HAS A PHASE, SO THE GATE HAS TO NAME ONE.

   The holo card sways on a seven-second clock, and the sweep walks 81 states
   that take different amounts of virtual time to reach. Measured without a
   pin, the four rarities landed 0.1px apart and the four pack-reveal states
   did too — not because any card is a different shape, but because the camera
   fired at four different moments of the same movement. Eight findings, all
   of them the harness's.

   The obvious fix is to stop the animation for the sweep, and it is the wrong
   one: a gate that switches a thing off to measure it is measuring something
   the player never sees, and this repo has a name for that. So the clock keeps
   running and the VALUE it writes is overridden instead. An !important author
   declaration outranks a CSS animation (verified: --holo-d reads exactly 1
   with animation-play-state still `running`), so every state is measured at
   d = +1 — the far end of the sway, 2.9deg of yaw, the hardest case rather
   than the easiest.

   What that buys: a geometric difference between two states is a real
   difference in the card, because the phase is no longer free to vary.
   What it gives up, honestly: nothing asserts the card holds still over time
   any more, because it no longer does. That one claim is replaced by three
   narrower ones in run.mjs — the lean is real, it is the same lean on every
   card, and it is bounded. */
const PIN_HI = 'skd-holo-hi'
const PIN_LO = 'skd-holo-lo'
const PIN_MID = 'skd-holo-mid'
const pinStyle = document.createElement('style')
pinStyle.textContent =
  `.${PIN_HI} .holo { --holo-d: 1 !important; }` +
  `.${PIN_LO} .holo { --holo-d: -1 !important; }` +
  `.${PIN_MID} .holo { --holo-d: 0 !important; }`
document.head.appendChild(pinStyle)
const htmlEl = document.documentElement
const pin = at => { htmlEl.classList.remove(PIN_HI, PIN_LO, PIN_MID); htmlEl.classList.add(at) }
pin(PIN_HI)

/* Lent to measure.js so the invariance anchors can read a row's LAYOUT
   position. Under a perspective lean a box's painted top also depends on
   where it sits horizontally, and a row is not a horizontal claim — the long
   version is beside the anchors in measure.js. try/finally because a throw in
   the middle would leave the whole sweep pinned flat, and a harness stuck in
   the wrong state is the quietest kind of green. */
window.__flatten = fn => {
  /* restores the pin it FOUND, not a hardcoded one. measure() captures its
     paint layers before it asks for this and its content boxes after, so a
     restore that disagrees with the entry state compares a flat layer against
     a leaning name: 22 invented `content partly hidden` findings, every one of
     them the harness measuring two different cards. Found by deliberately
     entering at the wrong pin, which is the only way it could have shown up.
     try/finally because a throw here would leave the whole sweep pinned flat,
     and a harness stuck in the wrong state is the quietest kind of green. */
  const was = [PIN_HI, PIN_LO, PIN_MID].find(c => htmlEl.classList.contains(c)) || PIN_HI
  pin(PIN_MID)
  try { fn() } finally { pin(was) }
}

/* How far the sway actually moves the card, measured by putting it at each
   end of its own travel. */
function swayOf () {
  const cf = document.querySelector('.screen .holo .cf')
  if (!cf) return null
  const read = at => {
    pin(at)
    const r = cf.getBoundingClientRect()
    const t = getComputedStyle(cf).transform
    const m = t === 'none' ? 0 : +t.slice(t.indexOf('(') + 1).split(',')[2]
    return { top: r.top, h: r.height, yaw: Number.isFinite(m) ? m : 0 }
  }
  const hi = read(PIN_HI)
  const lo = read(PIN_LO)
  /* `at` is read LAST, from whatever state this function leaves the page in —
     NOT from the `hi` sample above. Taken from `hi` it reported a leaning card
     no matter where the sweep was really pinned, which is the exact shape of
     lie the assertion exists to catch: proven by pinning the sweep flat and
     watching all 39 checks stay green. It only means "the sweep measured a
     leaning card" if it is the sweep's own pin that gets measured. */
  const back = read(PIN_HI)
  return {
    profile: cf.closest('.card-hit') ? 'opening' : 'standard',
    at: +Math.abs(back.yaw).toFixed(4),
    spread: +Math.max(Math.abs(hi.top - lo.top), Math.abs(hi.h - lo.h)).toFixed(2)
  }
}

/* READ-ONLY, and for the harness only. Some claims are about what the player
   OWNS rather than about what is on screen — "the diamonds left and the cards
   did not" cannot be read off a collection count, because a pack whose cards
   are already owned pays shards and moves no count at all. Exposed for
   reading; the cases still drive the app by clicking real elements, because
   reaching in to set state would be testing a reachability the player does
   not have. */
window.__store = store

const errors = []
const app = createApp(App)
app.config.errorHandler = (err, inst, info) => {
  errors.push(`${info}: ${err && err.message}`)
}
app.mount('#app')

window.addEventListener('error', e => errors.push('window: ' + e.message))
window.addEventListener('unhandledrejection', e => errors.push('rejection: ' + e.reason))

const raf = () => new Promise(r => requestAnimationFrame(() => r()))
const sleep = ms => new Promise(r => setTimeout(r, ms))

/* Breadcrumbs go to console.log as well as the page, because a case that
   hangs the main thread never gets to write the page at all — but Chrome's
   stderr (--enable-logging=stderr) survives being killed, which is how
   run.mjs can name the case that froze instead of just timing out. */
function trace (msg) {
  console.log('[skd-layout] ' + msg)
  const el = document.getElementById('progress')
  if (el) el.textContent += msg + '\n'
}

/* The transition is GSAP-driven (autoAlpha + y) with mode="out-in", so there
   is a window where the outgoing screen is the only .screen in the DOM, fully
   opaque and untransformed. Waiting for "some .screen looks settled" measures
   the PREVIOUS screen — which is how the first draft of this sweep reported 20
   identical copies of Home and called it a pass. Wait for the screen carrying
   the target key, with its enter tween landed. */
async function settle (want, extraMs) {
  let state = 'never appeared'
  for (let i = 0; i < 200; i++) {
    await raf()
    const all = document.querySelectorAll('.screen')
    if (all.length !== 1) { state = `${all.length} screens mounted`; continue }
    const el = all[0]
    if (el.dataset.screen !== want) { state = `showing ${el.dataset.screen}`; continue }
    const cs = getComputedStyle(el)
    const t = cs.transform
    if (cs.opacity !== '1' || (t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)')) {
      state = `mid-tween opacity=${cs.opacity} transform=${t}`
      continue
    }
    state = 'settled'
    break
  }
  if (extraMs) await sleep(extraMs)
  await nextTick()
  await raf()
  await raf()
  return state
}

/* Bounce through a key that is not a real screen, so that re-entering the SAME
   screen still remounts it: App keys <component> on currentScreen.

   The overlay has to be cleared here too, and for a sharper reason. A case
   sets store.overlay inside setup(), synchronously — so going from one
   'rankup' case to the next never toggles the v-if, the component is never
   remounted, and onMounted never runs again. The second case then measured
   the FIRST one's timeline, still paused where its act() left it, and the
   "a skip lands on the end state" group failed against a mid-flight
   reference. Clearing it through a flush is what makes each case's overlay
   actually its own. */
const bounce = () => { go('__bounce__'); store.overlay = null; return settle('__bounce__', 0) }

window.__screens = async () => {
  const results = []
  const q = new URLSearchParams(location.search)
  /* ?only=<substring> runs one slice: the whole sweep costs virtual-time
     budget, so debugging a single case needs a way in.
     ?shot=<id> goes further — it runs one case and leaves it standing, with
     the harness's own output hidden, so `chrome --screenshot` can photograph
     exactly the state the gate measured. A gate that can show its work is
     worth more than one that can only report a number.
     ?at=<seconds> moves a case that parks on a timeline to a different frame
     of it. Naming the frame beats waiting for it: under virtual time rAF
     fires on a shim and gsap's clock is not the wall clock, so "wait 0.6s and
     photograph" lands wherever it lands.
     ?scroll=<selector> brings something below the fold into the picture. It
     only applies while photographing: the sweep itself measures every state
     unscrolled, because where a thing sits before anyone touches it is the
     question the geometry checks are asking. */
  const shot = q.get('shot')
  const at = q.has('at') ? +q.get('at') : null
  const only = shot || q.get('only')
  const cases = only ? CASES.filter(c => c.id.includes(only)) : CASES
  if (shot) {
    for (const id of ['out', 'progress']) {
      const el = document.getElementById(id)
      if (el) el.style.display = 'none'
    }
  }

  for (const c of cases) {
    errors.length = 0
    /* before the reset, not after: cancelling needs the register that is
       about to be cleared, and the previous case may have left a flight
       parked in mid-air with its tokens still on screen */
    uiCancelAll()
    uiResetReport()
    if (window.__warns) window.__warns.length = 0
    trace(`start ${c.id}`)
    const rec = { id: c.id, screen: c.screen, group: c.group || null, scope: c.scope || null }
    try {
      rec.bounce = await bounce()
      c.setup()
      go(c.screen)
      rec.settle = await settle(c.screen, c.wait || 0)
      if (c.act) {
        await c.act({ raf, sleep, nextTick, click, at })
        rec.settle = await settle(c.screen, c.settleAfterAct || 0)
      }
      /* What the UI animations this case triggered actually cost. The budget
         in src/ui/motion.js §3 is only a promise while something checks it,
         and those five animations sit on the repeated path where an extra
         second is felt dozens of times a session. */
      rec.motion = uiReport()
      /* what every rolling figure READS at this frame. §2.1: the roll may
         decorate the answer, never withhold it — so the gate compares the
         digits on screen at frame zero against the digits at rest. */
      rec.counters = [...document.querySelectorAll('.count-up')].map(el => el.textContent.trim())
      /* The radar's actual geometry, not its props. Three animations have
         shipped in this repo pointed at elements that did not exist, and
         every one of them read correctly in the source — all three were
         caught by looking at what the element was really doing. The
         invariance check deliberately ignores SVG internals (a radar's
         vertices are the card's stats, not layout), so this is the only
         place that can tell a morph from a still picture. */
      /* A case can name something that must NOT be on screen yet. The tear
         is the one animation in step 6 allowed to gate information — a
         sealed pack you can already read is not sealed — so "the card has
         not appeared" is the thing worth asserting about it. */
      rec.tooEarly = c.expectAbsent ? !!document.querySelector(c.expectAbsent) : false
      /* The chrome's own geometry. Nothing else measures it: `anchors` only
         covers what is inside .screen, so the TopBar and the TabBar are the
         two boxes on this phone that no assertion was looking at — and they
         are the two that every screen's usable height is carved out of. */
      rec.chrome = {}
      for (const [name, sel] of [['TopBar', '.topbar'], ['TabBar', '.tabbar']]) {
        const el = document.querySelector(sel)
        if (!el) continue
        const r = el.getBoundingClientRect()
        const f = document.querySelector('.phone').getBoundingClientRect()
        rec.chrome[name] = {
          h: +r.height.toFixed(1),
          fromTop: +(r.top - f.top).toFixed(1),
          fromBottom: +(f.bottom - r.bottom).toFixed(1)
        }
      }
      rec.chromeTokens = {
        TopBar: getComputedStyle(document.documentElement).getPropertyValue('--topbar-h').trim(),
        TabBar: getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h').trim()
      }
      /* The MORPHING radar, named rather than taken by document order. This
         used to be every .shape on the screen, with run.mjs comparing the
         first — and the first is whichever radar happens to be earliest in
         the markup, so adding one anywhere above the chart silently moved the
         measurement onto a different picture. A target that drifts is a
         target that can describe something other than the thing under test. */
      rec.shapePoints = [...document.querySelectorAll('.screen .radwrap .radar .shape')]
        .map(el => el.getAttribute('points'))
      rec.flyTokens = [...document.querySelectorAll('.fly')].map(el => ({
        pointer: getComputedStyle(el).pointerEvents
      }))
      rec.skipLayers = [...document.querySelectorAll('[data-skip]')].map(el => ({
        name: el.getAttribute('data-skip'),
        bg: getComputedStyle(el).backgroundColor,
        bgImage: getComputedStyle(el).backgroundImage
      }))
      rec.sway = swayOf()
      const el = document.querySelector(`.screen[data-screen="${c.screen}"]`)
      rec.rendered = !!el && el.getBoundingClientRect().height > 0
      rec.nodes = el ? el.querySelectorAll('*').length : 0
      if (rec.rendered) Object.assign(rec, measure(c.scope))
    } catch (e) {
      rec.rendered = false
      errors.push('setup: ' + (e && e.message))
    }
    rec.errors = [...errors, ...new Set(window.__warns || [])]
    results.push(rec)
    if (shot) {
      const want = q.get('scroll')
      const el = want && document.querySelector(want)
      if (el) { el.scrollIntoView({ block: 'center' }); await raf() }
      // A live preview releases the camera pin only AFTER geometry is measured.
      if (q.get('live') === '1') htmlEl.classList.remove(PIN_HI, PIN_LO, PIN_MID)
      return { shot: rec.id }      // leave the screen up to be photographed
    }
    trace(`done  ${String(rec.id).padEnd(26)} rendered=${rec.rendered} nodes=${String(rec.nodes).padStart(4)} ` +
      `settle=${rec.settle} bounce=${rec.bounce} err=${rec.errors.length}`)
  }

  const phone = document.querySelector('.phone').getBoundingClientRect()
  return {
    /* what the app DECLARES a budget for, so run.mjs can fail on any of them
       that no state in the sweep ever played */
    budgets: { ...UI_BUDGET },
    viewport: { w: innerWidth, h: innerHeight },
    frame: { w: +phone.width.toFixed(1), h: +phone.height.toFixed(1) },
    results
  }
}

/* Click a real element, the way a finger would: screens keep their stage in
   local component state (PackOpen's stage, Cards' detail, Upgrade's done), and
   reaching in to set those refs would mean testing a reachability the player
   does not have. */
async function click (selector, nth = 0) {
  const el = document.querySelectorAll(selector)[nth]
  if (!el) throw new Error(`click: no ${selector}[${nth}]`)
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
  await raf()
}
