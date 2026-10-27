/* npm run layout — the part of "does it look broken" that a machine can hold.

   Two headless Chrome passes over one build:

     index.html    the match screen, driven frame by frame through a whole
                   compiled match, watching for mid-match layout shift
     screens.html  the whole app, walked state by state through every screen

   This exists because the engine gate (`npm run sim`) runs in node against a
   fake stage: it can see a thrown callback, but it cannot see a scoreboard row
   that appears at kick-off and shoves the feed down 11px. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const here = fileURLToPath(new URL('.', import.meta.url))
const dist = join(here, 'dist')
const CHROME = process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const pass = []
const fail = []
function check (label, value, ok) {
  ;(ok ? pass : fail).push({ label, value })
  console.log(`  ${label.padEnd(50)} ${String(value).padStart(8)}  ${ok ? 'PASS' : 'FAIL'}`)
}

await run('npx', ['vite', 'build', '--config', join(here, 'vite.config.js')])

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }
const server = createServer(async (req, res) => {
  const path = join(dist, decodeURIComponent(req.url.split('?')[0]))
  try {
    const body = await readFile(path)
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404).end() }
})
await new Promise(r => server.listen(0, r))
const port = server.address().port

/* The last case the harness announced and never finished. A case that spins
   the main thread (a reactive loop in a screen, say) freezes virtual time too,
   so Chrome never exits and never dumps: the only trail left is its stderr. */
function hungCase (stderr) {
  const started = []
  const finished = new Set()
  for (const line of String(stderr).split('\n')) {
    const m = line.match(/\[skd-layout\] (start|done) +([^\s",]+)/)
    if (!m) continue
    if (m[1] === 'start') started.push(m[2]); else finished.add(m[2])
  }
  const open = started.filter(id => !finished.has(id))
  return open.length ? open[open.length - 1] : null
}

/* execFile must be awaited, not sync: the page is served by the http server
   above, in this same process, so blocking the loop would deadlock. */
async function render (page, { size, budget, wall }) {
  let stdout, stderr
  try {
    ({ stdout, stderr } = await run(CHROME, [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'skd-layout-'))}`,
      `--virtual-time-budget=${budget}`, `--window-size=${size}`, '--hide-scrollbars',
      '--enable-logging=stderr', '--v=0',
      '--dump-dom', `http://127.0.0.1:${port}/${page}`
    ], { maxBuffer: 256 << 20, timeout: wall, killSignal: 'SIGKILL' }))
  } catch (e) {
    const hung = hungCase(e.stderr)
    throw new Error(hung
      ? `${page}: "${hung}" froze the browser — it never yielded, so no state after it was measured`
      : `${page}: chrome did not finish (${e.message.split('\n')[0]})`)
  }
  const m = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/)
  if (!m) throw new Error(`${page}: harness produced no output`)
  const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  if (!text) {
    const hung = hungCase(stderr)
    throw new Error(`${page}: harness never finished${hung ? ` — stopped at "${hung}"` : ''}` +
      ' (ran out of --virtual-time-budget?)')
  }
  if (text.startsWith('ERR')) throw new Error(`${page}: ${text.split('\n').slice(0, 3).join(' | ')}`)
  return JSON.parse(text)
}

let match, screens
try {
  match = await render('index.html', { size: '430,460', budget: 30000, wall: 60000 })
  screens = await render('screens.html', { size: '430,932', budget: 200000, wall: 300000 })
} catch (e) {
  server.close()
  console.log(`\nLAYOUT CHECK FAILED — the harness could not finish\n\n  ${e.message}\n`)
  process.exit(1)
} finally { server.close() }

/* ---------- the match screen, frame by frame ---------- */
console.log('\nMatch screen holds still for a whole match\n')
check('distinct stage heights during a match', match.stageHeights.length, match.stageHeights.length === 1)
check('distinct feed positions during a match', match.feedTops.length, match.feedTops.length === 1)
check('stage clips its overlays', match.stageClips, match.stageClips === 'hidden')
check('on-screen things parked by compiling', match.parkedByCompile.length, !match.parkedByCompile.length)

/* ---------- every screen, every state ---------- */
console.log(`\nEvery screen, every state  (${screens.results.length} states in a ${screens.frame.w}x${screens.frame.h} frame)\n`)

const broken = screens.results.filter(r => !r.rendered)
const noisy = screens.results.filter(r => r.errors.length)
check('states that rendered', `${screens.results.length - broken.length}/${screens.results.length}`, !broken.length)
check('states that logged an error or warning', noisy.length, !noisy.length)

/* Every finding below is counted per state, so one broken component on one
   screen cannot hide behind a total. */
const gather = kind => screens.results.flatMap(r => (r[kind] || []).map(v => ({ state: r.id, ...v })))
const clipped = gather('clipped')
const offFrame = gather('offFrame')
const truncated = gather('truncated')
const ellipsised = gather('ellipsised')
const overChrome = gather('overChrome')
const covered = gather('covered')
const leaky = gather('leakyTakeover')
const ragged = gather('ragged')
const small = gather('smallTargets')

check('content cropped by its container', clipped.length, !clipped.length)
check('elements laid out past the 430px frame', offFrame.length, !offFrame.length)
check('text cut off with nothing to show for it', truncated.length, !truncated.length)
check('things painting over the TopBar / TabBar', overChrome.length, !overChrome.length)
check('content hidden behind something on top of it', covered.length, !covered.length)
check('takeovers that do not take the whole frame', leaky.length, !leaky.length)
check('grid cells whose contents are ragged', ragged.length, !ragged.length)
check('controls under the 44px tap target', small.length, !small.length)

/* The main event. Within a group, every element the states have in common has
   to sit at the same height — a group is a set of states a player can watch
   one turn into another without navigating, so anything that moves between
   them moves out from under a thumb. */
const groups = new Map()
for (const r of screens.results) {
  if (!r.group || !r.rendered) continue
  if (!groups.has(r.group)) groups.set(r.group, [])
  groups.get(r.group).push(r)
}
const shifts = []
const emptyGroups = []
for (const [name, states] of groups) {
  if (states.length < 2) { emptyGroups.push(`${name} (only ${states.length} state rendered)`); continue }
  const shared = Object.keys(states[0].anchors).filter(k => states.every(st => k in st.anchors))
  /* A group that lines up almost nothing passes for free, which is exactly
     the kind of green this gate exists to stop. Coverage is measured against
     the smallest state, so a deliberately narrow `scope` still counts as full
     coverage of what it scoped. */
  const smallest = Math.min(...states.map(st => Object.keys(st.anchors).length))
  if (!shared.length || shared.length < smallest * 0.5) {
    emptyGroups.push(`${name} (${shared.length} of ${smallest} elements line up)`)
    continue
  }
  for (const k of shared) {
    const tops = states.map(st => st.anchors[k])
    if (new Set(tops).size > 1) {
      shifts.push({ group: name, key: k, spread: +(Math.max(...tops) - Math.min(...tops)).toFixed(1),
        detail: states.map((st, i) => `${st.id}=${tops[i]}`).join('  ') })
    }
  }
}
const groupSummary = [...groups].map(([n, st]) => `${n}:${st.length}`).join(' ')
check('elements that move between states of one screen', shifts.length, !shifts.length)
check('invariance groups comparing nothing', emptyGroups.length, !emptyGroups.length)

/* ---------- the UI animation budget (src/ui/motion.js, plan §3) ----------

   The match has a 30s cap and a solver to spend it. These five animations had
   no equivalent, and they are the ones on the repeated path: one match per
   bet, but dozens of pack openings, reward claims and upgrades in a session.
   An 8-second pack opening is harder to sit through than a 30-second match,
   and the failure is invisible in review — each animation is fine alone, the
   fifth pack is what hurts. Two rules, both mechanical:

     1. no animation may exceed its budget
     2. anything over a second has to be interruptible, and the interrupt has
        to land on the END state (that last part is the rankup-end invariance
        group, not a number — it is a layout claim, so the layout gate makes
        it) */
const motion = screens.results.flatMap(r => (r.motion || []).map(m => ({ state: r.id, ...m })))
const overBudget = motion.filter(m => m.duration > m.budget + 0.001)
const noExit = motion.filter(m => m.needsExit && !m.interruptible)
/* The interrupt surface covers the frame, bars included, and is exempt from
   the chrome assertion for it. The price of that exemption: it must hide
   nothing, and it must be gone the moment the animation ends. */
const doneByName = new Map(motion.map(m => [`${m.state}/${m.name}`, m.done]))
const skipLeaks = screens.results.flatMap(r => (r.skipLayers || [])
  .filter(l => doneByName.get(`${r.id}/${l.name}`) !== false)
  .map(l => ({ state: r.id, ...l })))
const skipOpaque = screens.results.flatMap(r => (r.skipLayers || [])
  .filter(l => l.bgImage !== 'none' || !/rgba\(0, 0, 0, 0\)|transparent/.test(l.bg))
  .map(l => ({ state: r.id, ...l })))

/* §2.1 for a rolling figure: the player may not have to wait out the roll to
   learn the answer. The payout starts at the STAKE rather than at zero, so
   the magnitude is right in the first frame — which is a claim about what is
   on screen, so it is checked against what is on screen. Missing either state
   fails too: a comparison with nothing to compare passes for free. */
const digits = t => (String(t).match(/\d/g) || []).length
const rollStart = screens.results.find(r => r.id === 'result/payout-start')
const rollEnd = screens.results.find(r => r.id === 'result/payout-settled')
const unreadable = (rollStart && rollEnd)
  ? (rollStart.counters || []).filter((t, i) => digits(t) < digits((rollEnd.counters || [])[i] || '') - 1)
      .map((t, i) => ({ start: t, end: (rollEnd.counters || [])[i] }))
  : [{ start: '(state missing)', end: '(state missing)' }]

/* Same bargain as the interrupt surface: a token allowed over the chrome
   bars must never take a tap, and must be gone once it has landed. */
const flyDone = new Map(motion.map(m => [`${m.state}/${m.name}`, m.done]))
const flyLeaks = screens.results.filter(r => (r.flyTokens || []).length && flyDone.get(`${r.id}/flyIn`) !== false)
  .map(r => ({ state: r.id, n: r.flyTokens.length }))
const flyTappable = screens.results.flatMap(r => (r.flyTokens || [])
  .filter(t => t.pointer !== 'none').map(t => ({ state: r.id, ...t })))

console.log(`\nUI animations stay inside the budget  (${motion.length} play(s) across the sweep)\n`)
check('UI animations over their time budget', overBudget.length, !overBudget.length)
check('long UI animations with no way to interrupt', noExit.length, !noExit.length)
check('interrupt surfaces left behind', skipLeaks.length, !skipLeaks.length)
check('interrupt surfaces that hide what is under them', skipOpaque.length, !skipOpaque.length)
check('rolling figures that start unreadable', unreadable.length, !unreadable.length)
check('flying tokens left behind', flyLeaks.length, !flyLeaks.length)
check('flying tokens that could eat a tap', flyTappable.length, !flyTappable.length)

if (ellipsised.length) {
  console.log(`\n  note: ${ellipsised.length} label(s) ellipsised — truncated, but visibly so:`)
  ellipsised.forEach(e => console.log(`    ${e.state}  ${e.key}  -${e.over}px  "${e.text}"`))
}

if (fail.length) {
  console.log(`\nLAYOUT CHECK FAILED — ${fail.length} assertion(s)\n`)
  if (match.stageHeights.length > 1) console.log('  stage heights seen:', match.stageHeights.join(', '))
  if (match.feedTops.length > 1) console.log('  feed tops seen:', match.feedTops.join(', '))
  match.parkedByCompile.forEach(p =>
    console.log(`  parked by compile: ${p.el}\n      ${p.was}  ->  ${p.now}`))
  broken.forEach(r => console.log(`  did not render: ${r.id} (settle: ${r.settle})`))
  noisy.forEach(r => r.errors.forEach(e => console.log(`  ${r.id}: ${e.split('\n')[0]}`)))
  clipped.forEach(c => console.log(`  cropped: ${c.state}  ${c.key} is ${c.over}px outside ${c.by} (${c.axis})  "${c.text}"`))
  offFrame.forEach(c => console.log(`  off-frame: ${c.state}  ${c.key} sticks out ${c.over}px (width ${c.width})  "${c.text}"`))
  truncated.forEach(c => console.log(`  cut text: ${c.state}  ${c.key} needs ${c.over}px more  "${c.text}"`))
  overChrome.forEach(c => console.log(`  over ${c.bar}: ${c.state}  ${c.key} by ${c.over}px  "${c.text}"`))
  leaky.forEach(l => console.log(`  leaky takeover: ${l.state}  ${l.key} leaves ${l.short}px of the frame showing`))
  covered.forEach(c => console.log(`  hidden: ${c.state}  ${c.key} is ${c.over}px behind ${c.behind}  "${c.text}"`))
  ragged.forEach(r => console.log(`  ragged: ${r.state}  ${r.grid} row at ${r.row} spreads ${r.spread}px — ${r.cells}`))
  const byTarget = new Map()
  small.forEach(t => {
    const k = `${t.key} is ${t.w}x${t.h}  "${t.text}"`
    byTarget.set(k, (byTarget.get(k) || 0) + 1)
  })
  ;[...byTarget].forEach(([k, n]) => console.log(`  too small to tap: ${k}${n > 1 ? `  (${n} states)` : ''}`))
  shifts.forEach(sh => console.log(`  moved: [${sh.group}] ${sh.key} by ${sh.spread}px — ${sh.detail}`))
  emptyGroups.forEach(g => console.log(`  compares nothing: ${g}`))
  overBudget.forEach(m => console.log(`  over budget: ${m.state}  ${m.name} is ${m.duration}s against a ${m.budget}s cap`))
  noExit.forEach(m => console.log(`  no way out: ${m.state}  ${m.name} runs ${m.duration}s with no interrupt surface`))
  skipLeaks.forEach(l => console.log(`  interrupt surface left behind: ${l.state}  [data-skip="${l.name}"]`))
  skipOpaque.forEach(l => console.log(`  interrupt surface is painted: ${l.state}  [data-skip="${l.name}"] bg ${l.bg} ${l.bgImage}`))
  unreadable.forEach(u => console.log(`  unreadable at frame zero: starts "${u.start}", lands "${u.end}"`))
  flyLeaks.forEach(f => console.log(`  flying tokens left behind: ${f.state}  ${f.n} token(s) still on .phone`))
  flyTappable.forEach(f => console.log(`  flying token takes taps: ${f.state}  pointer-events: ${f.pointer}`))
  console.log('')
  process.exit(1)
}
console.log(`\nLAYOUT CHECK PASSED  (${match.duration}s of match, ${screens.results.length} states, ` +
  `${pass.length} assertions, invariance groups ${groupSummary})\n`)
