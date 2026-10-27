/* Geometry for `npm run layout`. Runs in the page; returns violations, not a
   dump of every rect — a 430x932 screen has a few hundred boxes and the gate
   has to say what is WRONG, not what is there.

   The thing to keep in mind throughout: getBoundingClientRect does not know
   about clipping. overflow:hidden clips the PAINT, not the geometry, so a box
   that has been cut in half still reports its full rect. Every question below
   is therefore asked as "where is this box, and which ancestor is cutting it",
   never as "is this box inside that box". */

const TOL = 0.75          // subpixel noise from fractional layout

/* Elements that are allowed to cover the chrome bars: a bottom sheet with a
   scrim and a toast are meant to sit above everything. Anything else that
   reaches the TopBar or the TabBar is a bug. */
const CHROME_OVERLAYS = ['.sheet', '.toast']

/* Boxes that are MEANT to be bigger than their container and cropped by it:
   a full-bleed texture is drawn oversized on purpose. Everything else that
   gets cropped is a thing the player cannot read. */
const DECORATIONS = ['.ci-streaks', '.ci-bg', '.ci-tint', '.pk-bg', '.pk-vig', '.fi-bg', '.turf', '.sweep']
const decorative = el => DECORATIONS.some(sel => el.matches(sel))

function clips (cs, axis) {
  const v = axis === 'x' ? cs.overflowX : cs.overflowY
  return v === 'hidden' || v === 'clip'
}
function scrolls (cs, axis) {
  const v = axis === 'x' ? cs.overflowX : cs.overflowY
  return v === 'auto' || v === 'scroll'
}

/* An invisible box has no layout opinion worth reporting. The match overlays
   park themselves at visibility:hidden between beats, and a hidden box that
   overflows its stage is not something anyone can see. */
function invisible (el) {
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    const cs = getComputedStyle(n)
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return true
  }
  return false
}

/* Which ancestors actually crop this box.

   Not simply "every ancestor with overflow:hidden" — out-of-flow boxes escape.
   A position:fixed box is laid out against the viewport, so nothing above it
   clips it at all. A position:absolute box is only clipped from its containing
   block (its nearest positioned ancestor) upwards; the scroll container it
   happens to sit inside does not touch it.

   A transform makes a containing block too, and that is not a corner case
   here: App.vue animates the screen with gsap, which leaves an identity
   matrix behind, so .screen is a containing block for everything inside it
   even when it looks untransformed. A "position: fixed" overlay in a screen
   is therefore still trapped in — and cropped by — that screen. */
function containingBlock (cs) {
  return cs.position !== 'static' || cs.transform !== 'none' ||
    cs.filter !== 'none' || cs.perspective !== 'none' || cs.contain.includes('paint')
}
function clipAncestors (el) {
  const pos = getComputedStyle(el).position
  const out = []
  let reachedBlock = pos !== 'absolute' && pos !== 'fixed'
  for (let a = el.parentElement; a; a = a.parentElement) {
    const cs = getComputedStyle(a)
    if (!reachedBlock) {
      // a fixed box only escapes a positioned ancestor, not a transformed one
      const isBlock = pos === 'fixed'
        ? (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none')
        : containingBlock(cs)
      if (isBlock) reachedBlock = true
      else continue
    }
    if (clips(cs, 'x') || clips(cs, 'y') || scrolls(cs, 'x') || scrolls(cs, 'y')) out.push({ el: a, cs })
  }
  return out
}

/* What of this box actually reaches the screen: its rect cropped by everything
   above that crops it. Needed because overflow:hidden crops the paint and not
   the geometry — a scoreboard digit whose rect pokes into the TopBar is not
   painting on the TopBar if the stage cropped it first. */
function paintedRect (el, rect) {
  const r = { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
  for (const { el: a, cs } of clipAncestors(el)) {
    const ar = a.getBoundingClientRect()
    if (clips(cs, 'x') || scrolls(cs, 'x')) { r.left = Math.max(r.left, ar.left); r.right = Math.min(r.right, ar.right) }
    if (clips(cs, 'y') || scrolls(cs, 'y')) { r.top = Math.max(r.top, ar.top); r.bottom = Math.min(r.bottom, ar.bottom) }
  }
  return r
}

function classesOf (el) {
  return typeof el.className === 'string'
    ? el.className.trim().split(/\s+/).filter(c => c && !c.startsWith('data-v'))
    : []
}

/* Reporting name: as specific as possible, so a failure line is readable. */
function label (el) {
  const cls = classesOf(el)
  return el.tagName.toLowerCase() + (cls.length ? '.' + cls.slice(0, 3).join('.') : '')
}

/* Matching name, for lining the same element up across two states. Only the
   FIRST class, because the rest are state: .mission becomes .mission.ready the
   moment a task is claimable, .coin becomes .coin.done, .btn becomes
   .btn.btn-cta. Keying on all of them silently stops comparing the elements
   that changed — which is the one case the comparison exists for. */
function anchorKey (el) {
  const cls = classesOf(el)
  return el.tagName.toLowerCase() + (cls.length ? '.' + cls[0] : '')
}

function textOf (el) {
  return (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 46)
}

/* The nearest ancestor cutting `el` in `axis`, and by how much.
   A scroll container is NOT cutting: content below the fold is reachable.
   An element that overflows a scroll container horizontally when that
   container only scrolls vertically IS cut, which is the common case here —
   .scroll is overflow-y:auto / overflow-x:hidden. */
function clippedBy (el, rect, axis) {
  for (const { el: a, cs } of clipAncestors(el)) {
    if (scrolls(cs, axis)) return null
    if (!clips(cs, axis)) continue
    const ar = a.getBoundingClientRect()
    const lo = axis === 'x' ? ar.left : ar.top
    const hi = axis === 'x' ? ar.right : ar.bottom
    const elo = axis === 'x' ? rect.left : rect.top
    const ehi = axis === 'x' ? rect.right : rect.bottom
    const over = Math.max(lo - elo, ehi - hi)
    if (over > TOL) return { by: label(a), over: +over.toFixed(1) }
    return null                      // clipped by this one, but fits inside it
  }
  return null
}

/* Does this box paint text that has been cut off without saying so?
   scrollWidth > clientWidth means the text does not fit; ellipsis means the
   truncation is at least visible and deliberate, so it is reported separately
   rather than failed. */
function truncation (el, cs) {
  if (el.childElementCount > 0 && !el.childNodes.length) return null
  const hasOwnText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
  if (!hasOwnText) return null
  const over = el.scrollWidth - el.clientWidth
  if (over <= 1) return null
  const cut = clips(cs, 'x') || !!clippedBy(el, el.getBoundingClientRect(), 'x')
  if (!cut) return null
  return { over, ellipsis: cs.textOverflow === 'ellipsis' }
}

export function measure (scope) {
  const phone = document.querySelector('.phone')
  const screen = document.querySelector('.screen')
  const topbar = document.querySelector('.topbar')
  const tabbar = document.querySelector('.tabbar')
  const frame = phone.getBoundingClientRect()

  const out = {
    ragged: [],         // grid cells in one row whose contents are different heights
    smallTargets: [],   // tappable things under the published 44px minimum
    clipped: [],        // content cut off by an overflow:hidden ancestor
    offFrame: [],       // laid out past the edge of the 430px phone
    truncated: [],      // text cut off with no ellipsis to say so
    ellipsised: [],     // text cut off WITH an ellipsis — reported, not failed
    overChrome: [],     // painting onto the TopBar or the TabBar
    anchors: {}         // structural key -> top, for the invariance check
  }

  const bars = [
    topbar && { name: 'TopBar', rect: topbar.getBoundingClientRect() },
    tabbar && { name: 'TabBar', rect: tabbar.getBoundingClientRect() }
  ].filter(Boolean)

  /* A grid stretches its cells, but not necessarily what is INSIDE them: a
     CardFace does not fill the cell a locked placeholder sets the height of,
     so owned cards render 13px shorter than their neighbours and the grid
     looks ragged along the bottom. */
  for (const grid of phone.querySelectorAll('*')) {
    if (getComputedStyle(grid).display !== 'grid') continue
    const byRow = new Map()
    for (const cell of grid.children) {
      if (invisible(cell)) continue
      const r = cell.getBoundingClientRect()
      const row = Math.round(r.top)
      const kids = [...cell.children].filter(k => !invisible(k)).map(k => k.getBoundingClientRect())
      const h = kids.length ? Math.max(...kids.map(k => k.bottom)) - Math.min(...kids.map(k => k.top)) : r.height
      if (!byRow.has(row)) byRow.set(row, [])
      byRow.get(row).push({ h: +h.toFixed(1), what: label(cell.firstElementChild || cell) })
    }
    for (const [row, cells] of byRow) {
      if (cells.length < 2) continue
      const hs = cells.map(c => c.h)
      const spread = Math.max(...hs) - Math.min(...hs)
      if (spread > 1) {
        out.ragged.push({ grid: label(grid), row, spread: +spread.toFixed(1),
          cells: cells.map(c => `${c.what}=${c.h}`).join(' ') })
      }
    }
  }

  const seen = new Map()
  const anchorSeen = new Map()
  for (const el of phone.querySelectorAll('*')) {
    if (invisible(el)) continue
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) continue
    const cs = getComputedStyle(el)
    const name = label(el)

    const n = (seen.get(name) || 0) + 1
    seen.set(name, n)
    const key = n === 1 ? name : `${name}#${n}`

    /* Anchors: nth box of its shape, in document order. SVG internals are left
       out — a radar polygon's vertices are the card's STATS, so comparing them
       across two different cards compares data, not layout. */
    const inScope = scope ? (el.matches(scope) || !!el.closest(scope)) : !!el.closest('.screen')
    if (inScope && !el.closest('svg')) {
      const an = anchorKey(el)
      const i = (anchorSeen.get(an) || 0) + 1
      anchorSeen.set(an, i)
      out.anchors[i === 1 ? an : `${an}#${i}`] = +rect.top.toFixed(1)
    }

    if (!decorative(el)) {
      const cx = clippedBy(el, rect, 'x')
      const cy = clippedBy(el, rect, 'y')
      if (cx) out.clipped.push({ key, axis: 'x', ...cx, text: textOf(el) })
      if (cy) out.clipped.push({ key, axis: 'y', ...cy, text: textOf(el) })

      const off = Math.max(frame.left - rect.left, rect.right - frame.right)
      if (off > TOL) out.offFrame.push({ key, over: +off.toFixed(1), width: +rect.width.toFixed(1), text: textOf(el) })
    }

    const t = truncation(el, cs)
    if (t) (t.ellipsis ? out.ellipsised : out.truncated).push({ key, over: t.over, text: textOf(el) })

    /* Anything you are meant to tap has to be big enough to tap: 44px, the
       floor Apple and Google both publish. Measured on the PAINTED rect, so a
       target padded out past the edge of its scroll container counts only the
       part you can actually reach — which is how a 44px button turned out to
       be 41px of reachable button.
       Native inputs are left out: the browser gives a checkbox or a slider
       thumb a hit area bigger than its box. */
    const tappable = el.matches('button, a[href], [role="button"]') && !el.disabled
    if (tappable) {
      const pr = paintedRect(el, rect)
      const w = +(pr.right - pr.left).toFixed(1), h = +(pr.bottom - pr.top).toFixed(1)
      if (w > 0 && h > 0 && (w < 44 || h < 44)) out.smallTargets.push({ key, w, h, text: textOf(el) })
    }

    if (screen && screen.contains(el) && !CHROME_OVERLAYS.some(sel => el.closest(sel))) {
      const pr = paintedRect(el, rect)
      for (const bar of bars) {
        const ov = Math.min(pr.bottom, bar.rect.bottom) - Math.max(pr.top, bar.rect.top)
        const oh = Math.min(pr.right, bar.rect.right) - Math.max(pr.left, bar.rect.left)
        if (ov > TOL && oh > TOL) out.overChrome.push({ key, bar: bar.name, over: +ov.toFixed(1), text: textOf(el) })
      }
    }
  }
  return out
}
