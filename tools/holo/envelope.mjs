/* envelope.mjs — the WORST the foil ever does to the kit, not the one frame
   a screenshot happened to catch.

   --holo-x / --holo-y are a pointer position: a player can park the light
   anywhere from 0% to 100% on both axes, so a single capture measures one
   point of a surface. This walks a 5x5 grid of that surface for each rarity
   and keeps the worst hue shift. Captured at scale 1 because a mean colour
   over 20,000 pixels does not need retina. */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [caseId, outDir, width = '190', height = '266'] = process.argv.slice(2)
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9700 + Math.floor(process.pid % 250)
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--window-size=1400,932',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'skd-env-'))}`,
  '--no-first-run', '--no-default-browser-check',
  `http://localhost:8800/screens.html?shot=${caseId}`], { stdio: ['ignore','ignore','pipe'] })

let wsUrl = null
for (let i = 0; i < 120 && !wsUrl; i++) {
  await new Promise(r => setTimeout(r, 150))
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
    if (p) wsUrl = p.webSocketDebuggerUrl
  } catch {}
}
const ws = new WebSocket(wsUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let id = 0; const pending = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (m, p = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method: m, params: p })) })
const evalIn = expr => send('Runtime.evaluate', { expression: expr, returnByValue: true }).then(r => r.result.result.value)

for (let i = 0; i < 160; i++) {
  await new Promise(r => setTimeout(r, 150))
  if (await evalIn(`!!document.querySelector('.phone .hero .cf')`)) break
}

const meta = JSON.parse(await evalIn(`(() => {
  const hero = document.querySelector('.phone .hero')
  const row = document.createElement('div'); row.id = 'ladderrow'
  row.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;display:flex;gap:0;padding:0;background:#15181E'
  for (const r of ['C','R','E','L']) {
    const w = hero.cloneNode(true); w.style.width = '${width}px'
    const cf = w.querySelector('.cf')
    cf.classList.remove('r-C','r-R','r-E','r-L'); cf.classList.add('r-' + r)
    cf.style.width = '${width}px'; cf.style.height = '${height}px'
    w.style.animation = 'none'
    row.appendChild(w)
  }
  document.body.appendChild(row)
  const b = row.getBoundingClientRect()
  const cards = [...row.querySelectorAll('.cf')].map(cf => {
    const r = cf.getBoundingClientRect()
    return { rarity: [...cf.classList].find(c => /^r-[CREL]$/.test(c)),
      x: +(r.x - b.x).toFixed(2), y: +(r.y - b.y).toFixed(2),
      w: +r.width.toFixed(2), h: +r.height.toFixed(2) }
  })
  return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height, cards, scale: 1 })
})()`))
writeFileSync(join(outDir, 'env.json'), JSON.stringify(meta))

const clip = { x: meta.x, y: meta.y, width: meta.width, height: meta.height, scale: 1 }
const shoot = async name => {
  await new Promise(r => setTimeout(r, 180))
  const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip })
  writeFileSync(join(outDir, name), Buffer.from(s.result.data, 'base64'))
}
await evalIn(`(() => { const s=document.createElement('style'); s.id='killfoil';
  s.textContent='#ladderrow .cf-foil,#ladderrow .cf-gloss{display:none!important}';
  document.head.appendChild(s); return true })()`)
await shoot('env-off.png')
await evalIn(`(() => { document.getElementById('killfoil').remove(); return true })()`)

const STEPS = [0, 25, 50, 75, 100]
const grid = []
for (const gx of STEPS) for (const gy of STEPS) {
  await evalIn(`(() => { for (const w of document.querySelectorAll('#ladderrow .holo')) {
    w.style.setProperty('--holo-dx','${gx}%'); w.style.setProperty('--holo-dy','${gy}%') } return true })()`)
  const name = `env-${gx}-${gy}.png`
  await shoot(name)
  grid.push({ gx, gy, name })
}
writeFileSync(join(outDir, 'grid.json'), JSON.stringify(grid))
console.log(`${grid.length} positions -> ${outDir}`)
ws.close(); chrome.kill('SIGKILL')
