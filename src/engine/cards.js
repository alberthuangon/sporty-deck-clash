/* Card generation — PRD §4.3, §4.4, §4.6 / guide §5.1.
   Pure functions, no DOM. Card stats are DERIVED, never hand-written:
       rarity budget  (how many points)
     + archetype weights (what shape)
     + seed perturbation (so same-archetype cards differ)
     -> six display axes per level -> model-layer four values.
   The display layer is the single source of truth; the model layer is a
   projection of it (PRD §4.2). */

export const OUTFIELD_AXES = ['SHO', 'DRI', 'PAS', 'DEF', 'HOM', 'AWY']
export const GK_AXES = ['DIV', 'REF', 'POS', 'CMD', 'HOM', 'AWY']

export const AXIS_LABEL = {
  SHO: 'Shooting', DRI: 'Dribbling', PAS: 'Passing', DEF: 'Defending',
  DIV: 'Diving', REF: 'Reflexes', POS: 'Positioning', CMD: 'Command',
  HOM: 'Home Spirit', AWY: 'Away Form'
}

export const RARITY = {
  C: { label: 'Common', growth: 6, cap: 75 },
  R: { label: 'Rare', growth: 8, cap: 82 },
  E: { label: 'Epic', growth: 10, cap: 90 },
  L: { label: 'Legendary', growth: 12, cap: 99 }
}

export const BASE_BUDGET = 330
export const MAX_LEVEL = 10

/* archetype = six-axis weight vector, percent, sums to 100.
   role part sums to 64, venue part sums to 36. */
const ROLE_WEIGHTS = {
  striker:   { SHO: 21, DRI: 17, PAS: 14, DEF: 12 },
  playmaker: { SHO: 12, DRI: 19, PAS: 22, DEF: 11 },
  defender:  { SHO: 9,  DRI: 11, PAS: 16, DEF: 28 },
  allround:  { SHO: 16, DRI: 16, PAS: 16, DEF: 16 },
  reactive:  { DIV: 22, REF: 20, POS: 12, CMD: 10 },
  commander: { DIV: 14, REF: 12, POS: 18, CMD: 20 }
}

const VENUE_WEIGHTS = {
  home:    { HOM: 20, AWY: 16 },
  away:    { HOM: 16, AWY: 20 },
  neutral: { HOM: 18, AWY: 18 }
}

export const ROLE_LABEL = {
  striker: 'Striker', playmaker: 'Playmaker', defender: 'Defender', allround: 'All-rounder',
  reactive: 'Shot-stopper', commander: 'Commander'
}
export const VENUE_LABEL = { home: 'Home', away: 'Away', neutral: 'Neutral' }

function weightsFor (def) {
  return { ...ROLE_WEIGHTS[def.role], ...VENUE_WEIGHTS[def.venue] }
}

function axesFor (def) {
  return def.class === 'gk' ? GK_AXES : OUTFIELD_AXES
}

/* deterministic PRNG — same seed always gives the same card */
function mulberry32 (a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* Largest-remainder apportionment of `total` over `weights`, honouring `cap`.
   Axes that would breach the cap are pinned at the cap and their surplus is
   redistributed over the remaining axes (guide §5.1). */
function allocate (total, weights, cap, axes) {
  const pinned = new Set()
  for (let guard = 0; guard < axes.length + 1; guard++) {
    const free = axes.filter(k => !pinned.has(k))
    const rem = total - pinned.size * cap
    const wsum = free.reduce((s, k) => s + weights[k], 0)
    if (!free.length || wsum <= 0) break
    const over = free.filter(k => (rem * weights[k]) / wsum > cap)
    if (!over.length) {
      const out = {}
      axes.forEach(k => { out[k] = pinned.has(k) ? cap : 0 })
      const exact = {}
      free.forEach(k => { exact[k] = (rem * weights[k]) / wsum })
      let used = 0
      free.forEach(k => { out[k] = Math.floor(exact[k]); used += out[k] })
      let short = rem - used
      const order = [...free].sort((a, b) =>
        (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])) ||
        axes.indexOf(a) - axes.indexOf(b))
      let i = 0
      while (short > 0 && i < order.length * 4) {
        const k = order[i % order.length]
        if (out[k] < cap) { out[k] += 1; short -= 1 }
        i++
      }
      return out
    }
    over.forEach(k => pinned.add(k))
  }
  const out = {}
  axes.forEach(k => { out[k] = cap })
  return out
}

/* seed perturbation: deterministic +1/-1 swaps on the level-1 base so that two
   cards of the same archetype are not identical. Total stays exact. */
function perturb (base, def, cap, axes) {
  const rnd = mulberry32((def.seed || 1) * 2654435761)
  const swaps = 1 + Math.floor(rnd() * 2)
  for (let s = 0; s < swaps; s++) {
    const up = axes[Math.floor(rnd() * axes.length)]
    const down = axes[Math.floor(rnd() * axes.length)]
    if (up === down) continue
    if (base[up] + 1 > cap) continue
    if (base[down] - 1 < 1) continue
    base[up] += 1
    base[down] -= 1
  }
  return base
}

/* Full Lv.1-10 table for one card.
   Growth is applied incrementally with carried remainders, so every level adds
   exactly `growth` points, values never go down, caps are never breached, and
   each level only moves *some* axes — the growth personality of PRD §4.5. */
export function levelTable (def) {
  const axes = axesFor(def)
  const { growth, cap } = RARITY[def.rarity]
  const w = weightsFor(def)

  let cur = perturb(allocate(BASE_BUDGET, w, cap, axes), def, cap, axes)
  const table = [{ ...cur }]
  const carry = {}
  axes.forEach(k => { carry[k] = 0 })

  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    const free = axes.filter(k => cur[k] < cap)
    const wsum = free.reduce((s, k) => s + w[k], 0)
    const add = {}
    axes.forEach(k => { add[k] = 0 })
    if (wsum > 0) {
      const want = {}
      free.forEach(k => { want[k] = carry[k] + (growth * w[k]) / wsum })
      let used = 0
      free.forEach(k => {
        const room = cap - cur[k]
        add[k] = Math.min(Math.floor(Math.max(want[k], 0)), room)
        carry[k] = want[k] - add[k]
        used += add[k]
      })
      let short = growth - used
      let guard = 0
      while (short > 0 && guard < free.length * 6) {
        const k = free
          .filter(x => cur[x] + add[x] < cap)
          .sort((a, b) => carry[b] - carry[a] || axes.indexOf(a) - axes.indexOf(b))[0]
        if (!k) break
        add[k] += 1
        carry[k] -= 1
        short -= 1
        guard++
      }
    }
    const next = {}
    axes.forEach(k => { next[k] = cur[k] + add[k] })
    cur = next
    table.push({ ...cur })
  }
  return table
}

/* display axes -> model layer (PRD §4.3 / §4.4) */
export function g (x) { return 0.9 + 0.2 * (x / 100) }

export function toModel (axisValues, isGk) {
  const atk = isGk
    ? 0
    : (0.5 * axisValues.SHO + 0.3 * axisValues.DRI + 0.2 * axisValues.PAS) / 10
  const def = isGk
    ? (0.4 * axisValues.DIV + 0.3 * axisValues.REF + 0.2 * axisValues.POS + 0.1 * axisValues.CMD) / 10
    : axisValues.DEF / 10
  const gh = g(axisValues.HOM)
  const ga = g(axisValues.AWY)
  return {
    atk, def,
    homeAtk: atk * gh, awayAtk: atk * ga,
    homeDef: def * gh, awayDef: def * ga
  }
}

const tableCache = new Map()

export function cardTable (def) {
  if (!tableCache.has(def.id)) tableCache.set(def.id, levelTable(def))
  return tableCache.get(def.id)
}

/* The object every other layer consumes. */
export function buildCard (def, level = 1) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, level))
  const axisValues = cardTable(def)[lv - 1]
  const isGk = def.class === 'gk'
  return {
    ...def,
    level: lv,
    axes: axisValues,
    axisKeys: axesFor(def),
    total: Object.values(axisValues).reduce((a, b) => a + b, 0),
    cap: RARITY[def.rarity].cap,
    isGk,
    model: toModel(axisValues, isGk)
  }
}

export function axisDelta (def, level) {
  if (level >= MAX_LEVEL) return null
  const t = cardTable(def)
  const a = t[level - 1]; const b = t[level]
  const out = {}
  axesFor(def).forEach(k => { out[k] = b[k] - a[k] })
  return out
}
