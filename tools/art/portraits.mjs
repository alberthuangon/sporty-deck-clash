/* tools/art/portraits.mjs — rebuild src/assets/player-art/*-portrait.webp from
   the 1254px masters.

   The 160px portraits that shipped first were composed for a CIRCULAR mask in
   a 44px grid cell. The grid now shows them full-bleed in a 130x182 cell, and
   under object-fit: cover a SQUARE source is scaled to the cell's HEIGHT and
   then cropped sideways — so the number that matters is 182, not 130, and the
   old file was being asked to cover 182px with 160. Everything here exists to
   replace that one number honestly.

   WHICH MASTER. Four cards have a rerun under prompts/fixes/output and five
   have an "A" alternate beside the original, so a filename is not enough to
   say which take shipped: picking wrong swaps a player's face for a discarded
   version of the same player, which no assertion in this repo could see. Each
   shipped 160 is matched to its master by PIXELS instead — both decoded to
   32x32 and compared. The right answer comes back at rms 4.7-7.1 (resampling
   noise, not zero) and every rejected candidate at 48-57, so the margin does
   the deciding rather than the threshold.

   Chrome does the decoding and the encoding, because it is the only image
   library this machine has and because it is the same decoder that will read
   the result.

     node tools/art/portraits.mjs           # report the matches, write nothing
     node tools/art/portraits.mjs --write   # rebuild the twenty files */
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, writeFile, glob } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const REPO = join(here, '../..')
const BRAIN = '/Users/albert/SecondBrain/SportyKickDeck/art'
const WRITE = process.argv.includes('--write')
/* 384, not 260. The cell is 130x182 and cover fits the SHORT edge, so the
   square is drawn at 182x182 and cropped to 130 wide — 182 x 2 for a retina
   phone is 364, rounded up to a round number with a little headroom. */
const OUT_PX = 384
const QUALITY = 0.92

const ids = JSON.parse(await readFile(join(REPO, 'src/data/cards.json'), 'utf8')).cards.map(c => c.id)
const cands = {}
for (const dir of [`${BRAIN}/prompts/outputs`, `${BRAIN}/prompts/fixes/output`]) {
  for await (const f of glob(join(dir, '*-1.png'))) {
    const b = basename(f)
    const m = b.match(/^(?:\d\d|A\d)-([a-z]+\d+)-/i) || b.match(/^([A-Z]+\d+)-/)
    if (m) (cands[m[1].toUpperCase()] ||= []).push(f)
  }
}
const missing = ids.filter(i => !(cands[i] || []).length)
if (missing.length) { console.error('no master for: ' + missing.join(' ')); process.exit(1) }

const ROOTS = { '/repo': REPO, '/brain': BRAIN }
const TYPES = { '.png': 'image/png', '.webp': 'image/webp', '.html': 'text/html' }
const server = createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const root = Object.keys(ROOTS).find(k => url.startsWith(k + '/'))
  if (!root) return res.writeHead(404).end()
  try {
    const b = await readFile(join(ROOTS[root], url.slice(root.length + 1)))
    res.writeHead(200, { 'content-type': TYPES[extname(url)] || 'application/octet-stream' }); res.end(b)
  } catch { res.writeHead(404).end() }
})
await new Promise(r => server.listen(0, r))
const port = server.address().port
const PORT = 9600 + (process.pid % 300)
const chrome = spawn(process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'skd-art-'))}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] })
let wsUrl = null
for (let i = 0; i < 200 && !wsUrl; i++) {
  await new Promise(r => setTimeout(r, 150))
  try {
    const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const p = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
    if (p) wsUrl = p.webSocketDebuggerUrl
  } catch {}
}
if (!wsUrl) { chrome.kill('SIGKILL'); console.error('no CDP'); process.exit(1) }
const ws = new WebSocket(wsUrl)
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
let id = 0; const pend = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p = {}) => new Promise(r => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p })) })
const ev = async e => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500))
  return r.result?.result?.value
}
await send('Page.navigate', { url: `http://127.0.0.1:${port}/repo/index.html` })
await new Promise(r => setTimeout(r, 800))
await ev(`
window.load = src => new Promise((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('load ' + src)); i.src = src
})
window.thumb = async (src, n) => {
  const img = await load(src)
  const c = document.createElement('canvas'); c.width = n; c.height = n
  c.getContext('2d').drawImage(img, 0, 0, n, n)
  return [...c.getContext('2d').getImageData(0, 0, n, n).data]
}
window.rms = (a, b) => { let s = 0, n = 0
  for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) { const d = a[i+k] - b[i+k]; s += d*d; n++ }
  return Math.sqrt(s / n) }
window.reencode = async (src, n, q) => {
  const img = await load(src)
  const c = document.createElement('canvas'); c.width = n; c.height = n
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, n, n)
  return c.toDataURL('image/webp', q).split(',')[1]
}
true`)

const rows = []
for (const cardId of ids) {
  const shipped = `http://127.0.0.1:${port}/repo/src/assets/player-art/${cardId}-portrait.webp`
  const list = cands[cardId].map(f => f.replace(BRAIN, `http://127.0.0.1:${port}/brain`))
  const scores = JSON.parse(await ev(`(async () => {
    const want = await thumb(${JSON.stringify(shipped)}, 32)
    const out = []
    for (const u of ${JSON.stringify(list)}) out.push({ u, rms: +rms(want, await thumb(u, 32)).toFixed(2) })
    out.sort((a, b) => a.rms - b.rms)
    return JSON.stringify(out)
  })()`))
  const best = scores[0], runner = scores[1] || null
  let bytes = null
  if (WRITE) {
    const b64 = await ev(`reencode(${JSON.stringify(best.u)}, ${OUT_PX}, ${QUALITY})`)
    const buf = Buffer.from(b64, 'base64')
    await writeFile(join(REPO, 'src/assets/player-art', `${cardId}-portrait.webp`), buf)
    bytes = buf.length
  }
  rows.push({ cardId, master: basename(best.u), rms: best.rms, margin: runner ? +(runner.rms - best.rms).toFixed(1) : null, bytes })
}
ws.close(); chrome.kill('SIGKILL'); server.close()

const total = rows.reduce((a, r) => a + (r.bytes || 0), 0)
for (const r of rows) {
  console.log(`${r.cardId.padEnd(4)} ${r.master.padEnd(26)} rms ${String(r.rms).padStart(5)}` +
    (r.margin === null ? '   (only candidate)' : `   margin +${r.margin}`) +
    (r.bytes ? `   ${String(r.bytes).padStart(6)} B` : ''))
}
console.log(WRITE ? `\nwrote ${rows.length} files at ${OUT_PX}px, ${(total / 1024).toFixed(0)} KB total`
  : `\n(dry run — pass --write to rebuild at ${OUT_PX}px)`)
