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
       the DOM, fully settled (see settle()) */
import { createApp, nextTick } from 'vue'
import App from '../../src/App.vue'
import '../../src/styles/tokens.css'
import '../../src/styles/base.css'
import { store, go } from '../../src/store.js'
import { CASES } from './cases.js'
import { measure } from './measure.js'

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
   screen still remounts it: App keys <component> on currentScreen. */
const bounce = () => { go('__bounce__'); return settle('__bounce__', 0) }

window.__screens = async () => {
  const results = []
  const q = new URLSearchParams(location.search)
  /* ?only=<substring> runs one slice: the whole sweep costs virtual-time
     budget, so debugging a single case needs a way in.
     ?shot=<id> goes further — it runs one case and leaves it standing, with
     the harness's own output hidden, so `chrome --screenshot` can photograph
     exactly the state the gate measured. A gate that can show its work is
     worth more than one that can only report a number. */
  const shot = q.get('shot')
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
    if (window.__warns) window.__warns.length = 0
    trace(`start ${c.id}`)
    const rec = { id: c.id, screen: c.screen, group: c.group || null, scope: c.scope || null }
    try {
      rec.bounce = await bounce()
      c.setup()
      go(c.screen)
      rec.settle = await settle(c.screen, c.wait || 0)
      if (c.act) {
        await c.act({ raf, sleep, nextTick, click })
        rec.settle = await settle(c.screen, c.settleAfterAct || 0)
      }
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
