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
import { uiResetReport, uiReport } from '../../src/ui/motion.js'

gsap.ticker.lagSmoothing(0)

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
     photograph" lands wherever it lands. */
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
      rec.skipLayers = [...document.querySelectorAll('[data-skip]')].map(el => ({
        name: el.getAttribute('data-skip'),
        bg: getComputedStyle(el).backgroundColor,
        bgImage: getComputedStyle(el).backgroundImage
      }))
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
    if (shot) return { shot: rec.id }        // leave the screen up to be photographed
    trace(`done  ${String(rec.id).padEnd(26)} rendered=${rec.rendered} nodes=${String(rec.nodes).padStart(4)} ` +
      `settle=${rec.settle} bounce=${rec.bounce} err=${rec.errors.length}`)
  }

  const phone = document.querySelector('.phone').getBoundingClientRect()
  return {
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
