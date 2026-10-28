/* ladder.mjs — four rarities, one card, one frame, one light.
   The four rarity cases are four different PLAYERS, so comparing their
   screenshots compares kit colour as much as rarity. This clones ONE hero
   four times and swaps only the r-* class, and pins the drift so all four
   are lit from the same place. Then captures just that row. */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [caseId, outPath, width = '150', height = ''] = process.argv.slice(2)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9400 + Math.floor(process.pid % 400)
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--window-size=1400,932',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'skd-lad-'))}`,
  '--no-first-run', '--no-default-browser-check',
  `http://localhost:8800/screens.html?shot=${caseId}`
], { stdio: ['ignore', 'ignore', 'pipe'] })

let wsUrl = null
for (let i = 0; i < 120 && !wsUrl; i++) {
  await new Promise(r => setTimeout(r, 150))
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
    if (p) wsUrl = p.webSocketDebuggerUrl
  } catch {}
}
if (!wsUrl) { chrome.kill('SIGKILL'); console.error('no CDP'); process.exit(1) }
const ws = new WebSocket(wsUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })

for (let i = 0; i < 160; i++) {
  await new Promise(r => setTimeout(r, 150))
  const r = await send('Runtime.evaluate', { expression:
    `!!(document.querySelector('.phone .hero .cf'))`, returnByValue: true })
  if (r.result?.result?.value === true) break
}

const build = `(() => {
  const hero = document.querySelector('.phone .hero')
  const row = document.createElement('div')
  row.id = 'ladderrow'
  row.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;display:flex;gap:18px;padding:22px;background:#15181E'
  for (const r of ['C','R','E','L']) {
    const wrap = hero.cloneNode(true)
    wrap.style.width = '${width}px'
    const cf = wrap.querySelector('.cf')
    cf.classList.remove('r-C','r-R','r-E','r-L')
    cf.classList.add('r-' + r)
    cf.style.width = '${width}px'
    if ('${height}') cf.style.height = '${height}px'
    /* pin the light: g is 0 with nothing holding it, so --holo-x == --holo-dx */
    wrap.style.setProperty('--holo-dx', '38%')
    wrap.style.setProperty('--holo-dy', '44%')
    wrap.style.animation = 'none'
    row.appendChild(wrap)
  }
  document.body.appendChild(row)
  const b = row.getBoundingClientRect()
  /* report each card's box RELATIVE TO THE CLIP, so the diff never has to
     guess where a card is — guessing the window is how three measurements in
     this project came back wrong. */
  const cards = [...row.querySelectorAll('.cf')].map(cf => {
    const r = cf.getBoundingClientRect()
    return { rarity: [...cf.classList].find(c => /^r-[CREL]$/.test(c)),
      x: +(r.x - b.x).toFixed(2), y: +(r.y - b.y).toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2) }
  })
  return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height, cards })
})()`
const built = await send('Runtime.evaluate', { expression: build, returnByValue: true })
const clip = JSON.parse(built.result.result.value)
await new Promise(r => setTimeout(r, 400))
const shot = await send('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: true,
  clip: { ...clip, scale: 2 }
})
writeFileSync(outPath, Buffer.from(shot.result.data, 'base64'))

/* the same frame with the finish switched off — the zero point. Without it
   any number here measures the whole card rather than the foil's share. */
await send('Runtime.evaluate', { expression:
  `(() => { const s = document.createElement('style');
     s.textContent = '#ladderrow .cf-foil, #ladderrow .cf-gloss { display: none !important }';
     document.head.appendChild(s); return true })()`, returnByValue: true })
await new Promise(r => setTimeout(r, 300))
const off = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 2 } })
writeFileSync(outPath.replace(/\.png$/, '-off.png'), Buffer.from(off.result.data, 'base64'))
console.log(JSON.stringify({ out: outPath, scale: 2, ...clip }))
ws.close(); chrome.kill('SIGKILL')
