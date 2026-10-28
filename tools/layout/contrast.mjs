/* Can you read the card's own chrome over the picture behind it?

   A third pass, with a real Chrome and real screenshots, because this is the
   one question in this gate that cannot be answered from the DOM. Everything
   else here measures boxes; this measures PIXELS, and the two traps below are
   why it needs its own file rather than a few lines in measure.js.

   WHAT IT MEASURES, and the choice is the content of the check.

   Not the mean: a label whose average contrast is 9:1 can still have a third
   of its strokes sitting on a highlight, and that is what a broken label
   looks like — letters with holes, not letters that are evenly dim. Not the
   worst pixel either: a glyph box is mostly not glyph, so one bright pixel in
   the gap between two letters condemns text that is not standing on it. The
   first draft of this used the worst pixel and reported twenty of twenty
   failing at 66px, on a card that is plainly legible when you look at it.

   It measures THE SHARE OF INKED PIXELS BELOW AA. "How much of the letter is
   gone" is the thing a reader actually experiences, and it is the only one of
   the three that moved in the right direction every time the design did.

   TWO PREMISES, both learned by getting them wrong:

   1. THE GLYPH BOX IS NOT THE GLYPH. The ink is found by differencing two
      frames of the same card — one normal, one with `color: transparent` on
      the chrome. Not `visibility: hidden`: the moment the badge gained a
      background, hiding the element removed that too, so the difference
      covered the whole chip and the text was being scored against the picture
      its own backdrop had just hidden. The fix measured worse than the bug.
      Making only the colour transparent leaves every other layer exactly
      where it was, so the difference is letterforms and what remains behind
      them is what they are really read against.

   2. OWNED CARDS ARE THE EASY HALF. A locked card carries a .62 dark cover
      under its chrome, which makes every label easier to read. Sampling
      whichever cards a state happens to own would be sitting the easy half of
      the exam. The twenty real cells are cloned and forced unlocked instead.

   Both sizes a full-bleed card is used at, because the px floors on the type
   do not scale with the card: at 66px the same labels sit proportionally
   deeper into the picture than at 130, and only the small card showed it. */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const CHROME_SIZES = [130, 66]
export const CHROME_SELECTORS = ['.cf-pos', '.cf-lv', '.cf-name', '.cf-rar']

export async function measureChromeContrast ({ chromePath, url, sizes = CHROME_SIZES }) {
  const port = 9100 + (process.pid % 700)
  const proc = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`, '--window-size=1500,900',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'skd-contrast-'))}`,
    '--no-first-run', '--no-default-browser-check', url
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  let wsUrl = null
  for (let i = 0; i < 240 && !wsUrl; i++) {
    await new Promise(r => setTimeout(r, 150))
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl)
      if (p) wsUrl = p.webSocketDebuggerUrl
    } catch {}
  }
  if (!wsUrl) { proc.kill('SIGKILL'); throw new Error('contrast pass: Chrome never offered a debugger') }

  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0; const pend = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (method, params = {}) => new Promise(r => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('contrast pass: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
    return r.result?.result?.value
  }
  /* three consecutive sightings, not one: mode="out-in" leaves the OUTGOING
     screen mounted and settled for a moment, so a single match can land on
     the screen being replaced */
  let streak = 0, ready = false
  for (let i = 0; i < 260; i++) {
    await new Promise(r => setTimeout(r, 200))
    if (await ev(`!!document.querySelector('.grid .cf')`)) { if (++streak >= 3) { ready = true; break } } else streak = 0
  }
  if (!ready) { ws.close(); proc.kill('SIGKILL'); throw new Error('contrast pass: the collection grid never rendered') }

  const findings = []
  const roster = []
  for (const width of sizes) {
    const built = JSON.parse(await ev(`(async () => {
      document.getElementById('chromerow')?.remove()
      const slots = [...document.querySelectorAll('.grid .slot')]
      const row = document.createElement('div')
      row.id = 'chromerow'
      row.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;display:flex;flex-wrap:wrap;' +
        'width:' + (${width} + 10) * 10 + 'px;background:#0b0d12;padding:5px'
      const kept = []
      for (const slot of slots) {
        const cell = slot.cloneNode(true)
        cell.style.cssText = 'width:${width}px;flex:0 0 ${width}px;margin:5px'
        const cf = cell.querySelector('.cf')
        cf.style.width = '${width}px'
        cf.classList.remove('locked')
        cell.querySelectorAll('.cf-cover, .cf-lock').forEach(e => e.remove())
        row.appendChild(cell); kept.push(cell)
      }
      document.body.appendChild(row)
      await Promise.all([...row.querySelectorAll('img')].map(i => i.decode().catch(() => {})))
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      /* the guard an earlier draft did not have: an img.src rewritten past a
         content hash 404s silently, every clone falls back to the card body,
         and twenty paintings come back with four distinct values — one per
         RARITY. The tell was agreement, not error. */
      const imgs = [...row.querySelectorAll('.pa')]
      const broken = imgs.filter(i => !i.naturalWidth).length
      const distinct = new Set(imgs.map(i => i.currentSrc)).size
      if (broken || distinct !== imgs.length) {
        return JSON.stringify({ error: broken + ' picture(s) missing, ' + distinct + ' distinct of ' + imgs.length })
      }
      const b = row.getBoundingClientRect()
      const glyph = el => { const rg = document.createRange(); rg.selectNodeContents(el)
        const r = rg.getBoundingClientRect()
        return { x: r.x - b.x, y: r.y - b.y, w: r.width, h: r.height } }
      const out = kept.map(cell => {
        const id = (cell.querySelector('.pa').currentSrc.match(/([A-Z]+\\d+)-portrait/) || [, '??'])[1]
        const parts = {}
        for (const sel of ${JSON.stringify(CHROME_SELECTORS)}) {
          const el = cell.querySelector(sel)
          if (!el || !el.firstChild || !el.textContent.trim()) continue
          parts[sel] = { box: glyph(el), colour: getComputedStyle(el).color }
        }
        return { id, parts }
      })
      window.__dropInk = () => {
        for (const sel of ${JSON.stringify(CHROME_SELECTORS)}) {
          row.querySelectorAll(sel).forEach(e => { e.style.color = 'transparent' })
        }
        return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      }
      return JSON.stringify({ clip: { x: b.x, y: b.y, width: b.width, height: b.height }, out })
    })()`))
    if (built.error) { ws.close(); proc.kill('SIGKILL'); throw new Error('contrast pass: ' + built.error) }

    const inked = await send('Page.captureScreenshot', { format: 'png', clip: { ...built.clip, scale: 1 }, captureBeyondViewport: true })
    await ev('window.__dropInk()')
    const bare = await send('Page.captureScreenshot', { format: 'png', clip: { ...built.clip, scale: 1 }, captureBeyondViewport: true })

    const rows = JSON.parse(await ev(`(async () => {
      const load = d => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + d })
      const [A, B] = await Promise.all([load('${inked.result.data}'), load('${bare.result.data}')])
      const grab = img => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
        const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x }
      const ca = grab(A), cb = grab(B)
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
      const L = (r, g, bl) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl)
      const ratio = (a, b2) => (Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05)
      const parse = c => { const m = c.match(/[\\d.]+/g) || [0, 0, 0]; return L(+m[0], +m[1], +m[2]) }
      const out = []
      for (const d of ${JSON.stringify(built.out)}) {
        for (const [sel, part] of Object.entries(d.parts)) {
          const bx = part.box
          const sx = Math.max(0, Math.round(bx.x) - 1), sy = Math.max(0, Math.round(bx.y) - 1)
          const sw = Math.max(1, Math.round(bx.w) + 2), sh = Math.max(1, Math.round(bx.h) + 2)
          const a = ca.getImageData(sx, sy, sw, sh).data
          const b2 = cb.getImageData(sx, sy, sw, sh).data
          const col = parse(part.colour)
          let n = 0, lost = 0, sum = 0
          for (let i = 0; i < a.length; i += 4) {
            const diff = Math.abs(a[i] - b2[i]) + Math.abs(a[i+1] - b2[i+1]) + Math.abs(a[i+2] - b2[i+2])
            if (diff < 60) continue                       // not inked, or only faintly antialiased
            const r = ratio(col, L(b2[i], b2[i+1], b2[i+2]))
            n++; sum += r
            if (r < 4.5) lost++                           // AA for small text
          }
          if (n < 8) continue                             // too few pixels to say anything
          out.push({ id: d.id, sel, px: n, mean: +(sum / n).toFixed(2), lost: +(100 * lost / n).toFixed(1) })
        }
      }
      return JSON.stringify(out)
    })()`))
    for (const r of rows) { r.width = width; roster.push(r) }
  }
  ws.close(); proc.kill('SIGKILL')
  if (!roster.length) throw new Error('contrast pass: nothing was measured')
  return roster
}
