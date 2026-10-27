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
  screens = await render('screens.html', { size: '430,932', budget: 90000, wall: 75000 })
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

/* ---------- every screen, every state ---------- */
console.log(`\nEvery screen renders  (${screens.results.length} states in a ${screens.frame.w}x${screens.frame.h} frame)\n`)

const broken = screens.results.filter(r => !r.rendered)
const noisy = screens.results.filter(r => r.errors.length)
check('states that rendered', `${screens.results.length - broken.length}/${screens.results.length}`, !broken.length)
check('states that logged an error or warning', noisy.length, !noisy.length)

if (fail.length) {
  console.log(`\nLAYOUT CHECK FAILED — ${fail.length} assertion(s)\n`)
  if (match.stageHeights.length > 1) console.log('  stage heights seen:', match.stageHeights.join(', '))
  if (match.feedTops.length > 1) console.log('  feed tops seen:', match.feedTops.join(', '))
  broken.forEach(r => console.log(`  did not render: ${r.id} (settle: ${r.settle})`))
  noisy.forEach(r => r.errors.forEach(e => console.log(`  ${r.id}: ${e.split('\n')[0]}`)))
  console.log('')
  process.exit(1)
}
console.log(`\nLAYOUT CHECK PASSED  (${match.duration}s of match, ${screens.results.length} states, ${pass.length} assertions)\n`)
