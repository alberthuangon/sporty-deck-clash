/* npm run layout — build the match screen, drive a whole match in headless
   Chrome, and assert the geometry never moves underneath the player.

   This exists because the engine gate (`npm run sim`) runs in node against a
   fake stage: it can see a thrown callback, but it cannot see a scoreboard
   row that appears at kick-off and shoves the feed down 11px. */
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
  console.log(`  ${label.padEnd(44)} ${String(value).padStart(10)}  ${ok ? 'PASS' : 'FAIL'}`)
}

console.log('\nMatch screen holds still for a whole match (headless Chrome)\n')

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

let out
try {
  /* execFile must be awaited, not sync: the page is served by the http
     server above, in this same process, so blocking the loop would deadlock */
  const { stdout: dom } = await run(CHROME, [
    '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'skd-layout-'))}`,
    '--virtual-time-budget=30000', '--window-size=430,460',
    '--dump-dom', `http://127.0.0.1:${port}/index.html`
  ], { maxBuffer: 64 << 20 })
  const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)
  if (!m) throw new Error('harness produced no output')
  const text = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  if (text.startsWith('ERR')) throw new Error(text.split('\n')[0])
  out = JSON.parse(text)
} finally { server.close() }

check('distinct stage heights during a match', out.stageHeights.length, out.stageHeights.length === 1)
check('distinct feed positions during a match', out.feedTops.length, out.feedTops.length === 1)
check('stage clips its overlays', out.stageClips, out.stageClips === 'hidden')

if (fail.length) {
  console.log(`\nLAYOUT CHECK FAILED — ${fail.length} assertion(s)`)
  if (out.stageHeights.length > 1) console.log('  stage heights seen:', out.stageHeights.join(', '))
  if (out.feedTops.length > 1) console.log('  feed tops seen:', out.feedTops.join(', '))
  process.exit(1)
}
console.log(`\nLAYOUT CHECK PASSED  (${out.duration}s of match, ${pass.length} assertions)\n`)
