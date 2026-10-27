/* Diamonds, tickets and shards travelling to where they are kept — guide §10
   step 6 item 3.

   Two things this has to get right, and they pull against each other.

   The tokens are built imperatively and parented to `.phone`, not rendered by
   the component that starts them. That is deliberate: the usual way to write
   this is a `v-for` behind a `v-if`, and that is exactly the shape that has
   produced three dead animations in this repo — the element does not exist
   when the timeline is built. It also means the flight survives its own
   source: the rank-up takeover closes as its reward chips fly out of it, and
   a token owned by that component would unmount in mid-air.

   The price is that nothing cleans up for us. The timeline removes its own
   tokens, and `npm run layout` fails on any left behind — the same bargain
   the interrupt surface makes. */

import gsap from 'gsap'
import { uiPlay, UI_TIME } from './motion.js'

/* 'cash' / 'diamonds' name the wallet chips TopBar already marks up; anything
   starting with . [ or # is a selector; anything else is an element. */
function elementOf (x) {
  if (!x) return null
  if (typeof x !== 'string') return x
  return document.querySelector(/^[.[#]/.test(x) ? x : `[data-wallet="${x}"]`)
}

export function flyTo (from, to, { count = 6, glyph = '◆', colour = null } = {}) {
  const host = document.querySelector('.phone')
  const src = elementOf(from)
  const dst = elementOf(to)
  if (!host || !src || !dst) return null

  /* Measured NOW, synchronously, because `from` is routinely about to be
     unmounted by the same click that started the flight. */
  const hr = host.getBoundingClientRect()
  const a = src.getBoundingClientRect()
  const b = dst.getBoundingClientRect()
  const sx = a.left - hr.left + a.width / 2
  const sy = a.top - hr.top + a.height / 2
  const tx = b.left - hr.left + b.width / 2 - sx
  const ty = b.top - hr.top + b.height / 2 - sy

  const nodes = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i')
    el.className = 'fly'
    el.textContent = glyph
    if (colour) el.style.color = colour
    el.style.left = sx + 'px'
    el.style.top = sy + 'px'
    host.appendChild(el)
    nodes.push(el)
  }

  const dur = UI_TIME.flyIn
  /* carved out of the budget, not added to it — a stagger lengthens a
     timeline, which is how the first burst went over its cap */
  const spread = dur * 0.3
  const travel = dur - spread
  const stagger = count > 1 ? spread / (count - 1) : 0

  return uiPlay('flyIn', tl => {
    gsap.set(nodes, { x: i => (i - (count - 1) / 2) * 9, y: 0, scale: 0.55, opacity: 0 })
    tl.to(nodes, { opacity: 1, scale: 1, duration: travel * 0.25, ease: 'power1.out', stagger }, 0)
    tl.to(nodes, { x: tx, y: ty, duration: travel, ease: 'power2.inOut', stagger }, 0)
    tl.to(nodes, { opacity: 0, scale: 0.4, duration: travel * 0.3, ease: 'power1.in', stagger }, travel * 0.7)
    /* The destination acknowledges the arrival — without it the tokens
       vanish into a number that never reacted, and the flight reads as
       decoration. It BRIGHTENS rather than scales: a scale moves the thing
       it is applied to, and the gate caught the shard count shifting 0.6px
       under the player mid-flight. A destination is sometimes a pill in the
       top bar and sometimes a line of running text, and "do not move the
       words" has to hold for both without the call site having to decide. */
    tl.to(dst, { filter: 'brightness(1.8)', duration: dur * 0.09, yoyo: true, repeat: 1, ease: 'power2.out' }, travel * 0.76)
  }, { onEnd: () => { gsap.set(dst, { clearProps: 'filter' }); nodes.forEach(el => el.remove()) } })
}
