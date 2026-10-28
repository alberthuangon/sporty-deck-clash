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
const unsized = gather('unsizedImages')
const onTop = gather('textOverlaps')
const unchecked = gather('overlapUnchecked')

check('content cropped by its container', clipped.length, !clipped.length)
check('elements laid out past the 430px frame', offFrame.length, !offFrame.length)
check('text cut off with nothing to show for it', truncated.length, !truncated.length)
check('things painting over the TopBar / TabBar', overChrome.length, !overChrome.length)
/* PARTLY, and the word is load-bearing. Three people in a row — the two who
   wrote the holo spec and the one who wrote this file — predicted that a
   layer sitting over the card's own name would fail here, and it does not:
   a box swallowed WHOLE is an overlay doing its job, and only a partial
   eclipse is a layout mistake. The behaviour was always right; the NAME
   claimed a wider beat than the check walks, and the people misled by it
   included the people who wrote it. Both proposed fixes would have loosened
   the gate to permit something it already permitted. */
check('content partly hidden behind something on top of it', covered.length, !covered.length)
check('takeovers that do not take the whole frame', leaky.length, !leaky.length)
check('grid cells whose contents are ragged', ragged.length, !ragged.length)
check('controls under the 44px tap target', small.length, !small.length)
check('images that reserve no space', unsized.length, !unsized.length)
check('text sitting on other text', onTop.length, !onTop.length)

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
/* A timeline shorter than its dial is worse than one over its cap: the number
   stops describing the animation, so the cap stops bounding it and MotionLab
   stops controlling it. */
const offDial = motion.filter(m => Math.abs(m.duration - m.spend) > 0.02)
/* A budget nothing exercises is a budget that passes for free — the same hole
   this gate's own README warns about. Every declared animation has to be
   played by at least one state in the sweep, or the cap on it means nothing. */
const played = new Set(motion.map(m => m.name))
const unplayed = Object.keys(screens.budgets || {}).filter(k => !played.has(k))
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

/* Did the radar actually MOVE? A morph whose tween runs against nothing
   looks identical to a working one from the outside, and identical in the
   source — so the shape's geometry mid-morph is compared against its
   geometry at rest. Same shape in both frames means the animation is dead. */
const morphMid = screens.results.find(r => r.id === 'upgrade/radar-morphing')
const morphEnd = screens.results.find(r => r.id === 'upgrade/done')
const still = (morphMid && morphEnd && (morphMid.shapePoints || []).length && (morphEnd.shapePoints || []).length)
  ? (morphMid.shapePoints[0] === morphEnd.shapePoints[0]
      ? [{ what: 'radar', mid: morphMid.shapePoints[0].slice(0, 40) }] : [])
  : [{ what: 'radar', mid: '(state missing)' }]

/* ---------- the chrome ----------

   The TopBar and the TabBar are the only two boxes in the frame that nothing
   above was checking: the invariance anchors are scoped to .screen, so a bar
   that grew taller on one screen, or that stopped matching the token every
   screen's usable height is carved out of, passed everything. Proven rather
   than assumed — a TabBar forced to 64px while --tabbar-h still read 58px
   cleared all 27 of the assertions above it.

   Two claims. Wherever a bar appears it is the SAME bar — same height, same
   distance from its edge — because the player walks between these screens
   without the tabs under their thumb moving. And its measured height matches
   the token that declares it, so the number in tokens.css keeps describing
   the thing it names. */
const chromeShifts = []
const chromeDrift = []
const barStates = new Map()
for (const r of screens.results) {
  if (!r.rendered || !r.chrome) continue
  for (const name of Object.keys(r.chrome)) {
    if (!barStates.has(name)) barStates.set(name, [])
    barStates.get(name).push({ id: r.id, ...r.chrome[name], token: (r.chromeTokens || {})[name] })
  }
}
for (const [name, states] of barStates) {
  const edge = name === 'TopBar' ? 'fromTop' : 'fromBottom'
  for (const key of ['h', edge]) {
    const seen = [...new Set(states.map(st => st[key]))]
    if (seen.length > 1) {
      const worst = states.filter(st => st[key] !== states[0][key]).slice(0, 3)
      chromeShifts.push({ bar: name, key, seen: seen.join(', '),
        detail: worst.map(st => `${st.id}=${st[key]}`).join('  ') })
    }
  }
  const declared = parseFloat(states[0].token)
  if (Number.isFinite(declared) && Math.abs(states[0].h - declared) > 0.5) {
    chromeDrift.push({ bar: name, measured: states[0].h, declared })
  }
}

/* ---------- the holo finish ----------

   The foil sits over the card's own name, level and role. The covered-content
   check lets it through on purpose — a layer that swallows a box WHOLE is an
   overlay doing its job — but that means it passes because of its size, and
   nothing was asking the question that actually matters for a decorative
   layer: can you still read the card through it? Verified: a foil inset to
   cover only part of the card fails `content hidden behind something on top
   of it` with 4 findings, while the same foil at full size passes. So the
   protection cannot come from there.

   Two properties instead, the same bargain the flying tokens make: it must
   stay see-through, and it must never take a tap. */
const holo = screens.results.flatMap(r => (r.holoLayers || []).map(h => ({ state: r.id, ...h })))
const holoSolid = holo.filter(h => h.effective > 0.5)
const holoTappable = holo.filter(h => h.pointer !== 'none')
/* A blend mode on top of an opaque background-colour is a layer that PAINTS
   and blends the paint — the content under it is gone either way. This is the
   third leg of the bargain, and it is the one the full-card finish made
   necessary: a foil clipped to the artwork could only ever hide artwork. */
const holoPainting = holo.filter(h => h.solidBg)

const early = screens.results.filter(r => r.tooEarly).map(r => ({ state: r.id }))

console.log(`\nUI animations stay inside the budget  (${motion.length} play(s) across the sweep)\n`)
check('UI animations over their time budget', overBudget.length, !overBudget.length)
check('long UI animations with no way to interrupt', noExit.length, !noExit.length)
check('UI animations that ignore their dial', offDial.length, !offDial.length)
check('declared animations the sweep never played', unplayed.length, !unplayed.length && !!Object.keys(screens.budgets || {}).length)
check('interrupt surfaces left behind', skipLeaks.length, !skipLeaks.length)
check('interrupt surfaces that hide what is under them', skipOpaque.length, !skipOpaque.length)
check('rolling figures that start unreadable', unreadable.length, !unreadable.length)
check('flying tokens left behind', flyLeaks.length, !flyLeaks.length)
check('flying tokens that could eat a tap', flyTappable.length, !flyTappable.length)
check('shapes that animate without moving', still.length, !still.length)
check('content revealed before its animation finished', early.length, !early.length)
check('chrome that changes between screens', chromeShifts.length, !chromeShifts.length && barStates.size === 2)
check('chrome that does not match its token', chromeDrift.length, !chromeDrift.length)
check('foil layers you cannot see through', holoSolid.length, !holoSolid.length && !!holo.length)
check('foil layers that could eat a tap', holoTappable.length, !holoTappable.length)
check('foil layers painting instead of blending', holoPainting.length, !holoPainting.length)

/* THE BASELINE LIVES HERE, in the line that prints every run, because the
   alternative is somebody's memory or a file in a scratchpad.

   Taken once the rarity ladder settled into a count of colours rather than a
   count of lumens, and once the finish lit the player without repainting him.
   When twenty illustrations land and the card grows from 190 to 320 the
   foil's area grows with it, and alpha has to come DOWN to keep the same
   average contribution over the whole card. These two numbers are what "the
   same" means.

   Measured beside them by differencing a frame against itself with the finish
   hidden (scratchpad foildiff.py / hair.py), at 190x266:

     mean contribution   C 4.96   R 21.71   E 32.12   L 38.19
     coverage            C .130   R .563    E .635    L .861
     hue spread          C .222   R .361    E .694    L .833
     hair hue, lit       C 16.8   R 296.2   E 339.2   L 18.1   (unlit 16.8)

   Drift is not a failure — the art is still arriving and these will be
   retuned on purpose. It prints so that the retune is a decision somebody
   makes rather than something that happens to them. */
const HOLO_BASELINE = { 'i.cf-foil': 0.45, 'i.cf-gloss': 0.26 }

/* Printed even when every one of them passes. The three checks above are the
   price of sitting over the card's own name, and a layer that quietly stopped
   being found would buy that exemption in silence — so the roster is the
   evidence that the checks are still looking at something. */
if (unchecked.length) {
  const byPair = new Map()
  for (const u of unchecked) byPair.set(`${u.a} / ${u.b}`, (byPair.get(`${u.a} / ${u.b}`) || 0) + 1)
  console.log(`\n  note: ${byPair.size} overlapping text pair(s) the check could not judge — clip-path:`)
  for (const [k, n] of byPair) console.log(`    ${k}  (${n} state${n > 1 ? 's' : ''})`)
}

if (holo.length) {
  const roster = new Map()
  for (const h of holo) {
    const cur = roster.get(h.key)
    if (!cur || h.effective > cur.effective) roster.set(h.key, h)
  }
  console.log(`\n  note: ${roster.size} compositing layer(s) over card content, ${holo.length} sighting(s):`)
  for (const h of roster.values()) {
    const base = HOLO_BASELINE[h.key]
    const drift = base === undefined ? '  (no baseline)'
      : h.effective === base ? `  = baseline`
      : `  vs baseline ${base}  ${h.effective > base ? '+' : ''}${(h.effective - base).toFixed(2)}`
    console.log(`    ${h.key}  ${h.blend}  worst alpha x opacity ${h.effective}${drift}  pointer-events ${h.pointer}` +
      (h.solidBg ? '  SOLID BACKGROUND' : ''))
  }
}

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
  onTop.forEach(o => console.log(`  on top of each other: ${o.state}  ${o.a} and ${o.b} overlap by ${o.bite}px of a ${o.of}px line  "${o.text}"`))
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
  offDial.forEach(m => console.log(`  ignores its dial: ${m.state}  ${m.name} compiled to ${m.duration}s for a ${m.spend}s dial`))
  unplayed.forEach(k => console.log(`  never played: "${k}" has a budget and no state in the sweep exercises it`))
  skipLeaks.forEach(l => console.log(`  interrupt surface left behind: ${l.state}  [data-skip="${l.name}"]`))
  skipOpaque.forEach(l => console.log(`  interrupt surface is painted: ${l.state}  [data-skip="${l.name}"] bg ${l.bg} ${l.bgImage}`))
  unreadable.forEach(u => console.log(`  unreadable at frame zero: starts "${u.start}", lands "${u.end}"`))
  flyLeaks.forEach(f => console.log(`  flying tokens left behind: ${f.state}  ${f.n} token(s) still on .phone`))
  flyTappable.forEach(f => console.log(`  flying token takes taps: ${f.state}  pointer-events: ${f.pointer}`))
  still.forEach(d => console.log(`  did not move: the ${d.what} measures the same mid-animation as at rest — ${d.mid}`))
  early.forEach(e => console.log(`  revealed early: ${e.state} is already showing what the animation was hiding`))
  if (barStates.size !== 2) console.log(`  chrome never measured: saw ${[...barStates.keys()].join(', ') || 'no bars'} — expected TopBar and TabBar`)
  chromeShifts.forEach(c => console.log(`  chrome moved: ${c.bar} ${c.key} takes values ${c.seen} — ${c.detail}`))
  chromeDrift.forEach(c => console.log(`  chrome drifted: ${c.bar} measures ${c.measured}px against a token that says ${c.declared}px`))
  if (!holo.length) console.log('  foil never measured: no state in the sweep shows a holo card')
  holoSolid.forEach(h => console.log(`  foil too solid: ${h.state}  ${h.key} hides up to ${h.effective} (stop ${h.maxStopAlpha} x opacity ${h.opacity})`))
  holoTappable.forEach(h => console.log(`  foil takes taps: ${h.state}  ${h.key} pointer-events: ${h.pointer}`))
  console.log('')
  process.exit(1)
}
console.log(`\nLAYOUT CHECK PASSED  (${match.duration}s of match, ${screens.results.length} states, ` +
  `${pass.length} assertions, invariance groups ${groupSummary})\n`)
