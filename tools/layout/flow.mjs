/* Does the pack hand over what it charged for?

   A fourth pass, and the narrowest one here: it drives the real app through
   every way out of the pack-opening screen and checks one thing at each exit.

   WHY IT IS NOT A LAYOUT CHECK. The bug it guards against moved money and did
   not move goods, and nothing else in this repo can see that. The layout gate
   measures boxes; `npm run sim` runs the engine's maths against a fake stage.
   The transaction BETWEEN screens — charge here, deliver three taps later,
   player walks out in between — had nobody watching it, and all three ways
   out were broken at once: 100 diamonds and no cards, 100 and two of five,
   and a third where the demo script replayed because the "seen" flag was set
   on the summary screen rather than at the tear.

   THE RULE IS A LEDGER, not a sequence. Either nothing happened — no charge,
   no cards — or the whole thing happened: the price left the wallet and all
   five cards arrived. Anything in between is the bug. Stated that way it does
   not care how the player left, which is the point: the next exit somebody
   adds is covered without anybody remembering to cover it.

   EVERY EXIT, NOT A SAMPLE OF THEM. Leaving on the sealed pack, at the first
   card, at a middle card, at the last card before the summary, and from the
   summary itself. One route is not a measurement of a flow, the same way one
   state was not a measurement of a screen.

   WHAT IT CANNOT SEE: onUnmounted does not run if the tab is closed or
   reloaded, and the store persists. So "reveal two cards, then refresh" still
   lands on the old bug — paid for five, holding two. The window is much
   smaller than it was (it needs a reload, not a back button) and a demo will
   not hit it, but it is not shut, and the line in PackOpen.vue that looks
   like it shuts it does not. Closing it properly means the pulls surviving a
   reload, which is a store change rather than a screen one. */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/* stage -> how many "next" taps after the tear before walking out */
export const PACK_EXITS = [
  { id: 'sealed, never torn', taps: null },
  { id: 'at the first card', taps: 0 },
  { id: 'at a middle card', taps: 2 },
  { id: 'at the last card', taps: 4 },
  { id: 'from the summary', taps: 5 }
]

export async function measurePackLedger ({ chromePath, url }) {
  const port = 9800 + (process.pid % 160)
  const proc = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, '--window-size=430,932',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'skd-flow-'))}`,
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
  if (!wsUrl) { proc.kill('SIGKILL'); throw new Error('pack ledger: Chrome never offered a debugger') }
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0; const pend = new Map()
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (method, params = {}) => new Promise(r => { const n = ++id; pend.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('pack ledger: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    return r.result?.result?.value
  }
  let streak = 0, ready = false
  for (let i = 0; i < 260; i++) {
    await new Promise(r => setTimeout(r, 200))
    if (await ev(`!!(window.__store && document.querySelector('.screen[data-screen="shop"] .pack .buy'))`)) {
      if (++streak >= 3) { ready = true; break }
    } else streak = 0
  }
  if (!ready) { ws.close(); proc.kill('SIGKILL'); throw new Error('pack ledger: the shop never rendered') }

  const result = JSON.parse(await ev(`(async () => {
    const S = window.__store
    const raf = () => new Promise(r => requestAnimationFrame(() => r()))
    /* wait for a CONDITION, never a frame count: a fixed wait that is a
       little short turns a broken flow into a quiet pass, which is the way a
       cross-screen check is most likely to lie. */
    const until = async (fn, what) => {
      for (let i = 0; i < 400; i++) { if (fn()) return true; await raf() }
      throw new Error('never happened: ' + what)
    }
    const click = async (sel, what) => {
      const e = document.querySelector(sel)
      if (!e) throw new Error('nothing to click for ' + what + ' (' + sel + ')')
      e.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await raf(); await raf()
    }
    const screen = () => (document.querySelector('.screen') || {}).dataset?.screen
    /* one figure for "cards this player holds": a new card lifts a level off
       zero, a duplicate adds a shard, and both are one card handed over. A
       collection COUNT cannot do this job — the scripted pack's first card is
       already owned, so it pays a shard and moves no count at all, which is
       how losing three of five went unnoticed. */
    const received = () => Object.values(S.ownedCards)
      .reduce((n, v) => n + (v.level >= 1 ? 1 : 0) + v.shards, 0)

    const out = []
    for (const exit of ${JSON.stringify(PACK_EXITS)}) {
      await until(() => screen() === 'shop', 'the shop for ' + exit.id)
      const buy = document.querySelector('.pack .buy')
      const price = +(buy.textContent.match(/\\d+/) || [0])[0]
      const before = { gems: S.diamonds, cards: received() }

      await click('.pack .buy', 'buying a pack')
      await until(() => screen() === 'packopen' && document.querySelector('.stage'), 'the pack screen')
      let reached = 'sealed'

      if (exit.taps !== null) {
        await click('.stage .btn-cta', 'tearing the pack')
        await until(() => !!document.querySelector('.counter'), 'the first card')
        reached = document.querySelector('.counter').textContent.trim()
        for (let i = 0; i < exit.taps; i++) {
          const was = document.querySelector('.counter')?.textContent
          await click('.stage .btn-cta', 'the next card')
          await until(() => document.querySelector('.counter')?.textContent !== was ||
                            !!document.querySelector('.sum-grid'), 'card ' + (i + 2))
        }
        reached = document.querySelector('.sum-grid') ? 'summary'
          : document.querySelector('.counter').textContent.trim()
      }

      await click('.tb-back', 'leaving the pack screen')
      await until(() => screen() === 'shop', 'the shop again')
      const after = { gems: S.diamonds, cards: received() }
      out.push({
        exit: exit.id, reached, price,
        spent: before.gems - after.gems,
        gained: after.cards - before.cards
      })
    }
    return JSON.stringify(out)
  })()`))

  ws.close(); proc.kill('SIGKILL')
  if (result.length !== PACK_EXITS.length) {
    throw new Error(`pack ledger: ${result.length} of ${PACK_EXITS.length} exits were walked`)
  }
  return result
}

/* EITHER NOTHING HAPPENED OR ALL OF IT DID — unchanged, and deliberately so.

   The moment of purchase moved (it is the Shop's buy button now, not the
   tear) and the expected row for "left on the sealed pack" moved with it,
   from 0 -> 0 to the price -> 5. The RULE did not move: a pack is still all
   or nothing, and the reason the row changed is that the player has already
   bought it by the time that screen exists, not that the invariant was
   relaxed to fit.

   Which is why this is still written as a ledger over spent and gained
   rather than as a table of expected values per exit. A table would have
   needed editing in five places to say the same thing, and each edit is a
   chance to write down what the code does instead of what it should. */
export function ledgerBroken (rows) {
  return rows.filter(r => (r.spent === 0 ? r.gained !== 0 : !(r.spent === r.price && r.gained === 5)))
}
