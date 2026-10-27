/* Player art — twenty individuals, built rather than drawn.

   Same bargain as src/ui/icons.js: geometry is DATA, a component turns it into
   real elements, nothing uses v-html. The difference is that an icon is one
   shape and a player is a body, so what is stored here is a SKELETON — joints,
   in one 74x74 space — and the parts are assembled per size tier.

   Two subjects, because they are two different problems:

     buildPortrait(id, tier)   head and shoulders. The 44px workhorse: the
                               collection grid, the squad panel, deck edit,
                               history, the pack pile. A face fills the canvas,
                               so hair and jaw do the identifying.
     buildFigure(id, tier)     the whole body in a role pose. 116px only, where
                               the holo card lives.

   Why a builder instead of baked path lists: twenty cards x two subjects x
   three tiers is 120 drawings, and they would still not answer the question
   this project already learned the hard way with the trophy icon — a symbol
   drawn for one size is the wrong symbol at another. Here the tier table owns
   BOTH the stroke widths and WHICH PARTS EXIST, so the 44px build is a
   different composition that happens to share a pose.

   Widths in TIERS are RENDERED pixels, multiplied by 74/size on the way out,
   so "4.4" means 4.4px on screen at every tier.

   Everything returns LAYERS, not a flat list:

     { bg, rim, body, fg, mask }

   because the holo pass needs to put foil BETWEEN things and to clip it to the
   subject. `mask` is the body drawn fat and white, ready to drop inside a
   <mask>. Flattening is one line (see flatten()) for anyone who does not care.

   Red lines honoured here, each with its reason:
     - no real likeness; no real crest or stripe set. The invented kit
       vocabulary is one collar notch and one shoulder band, and nothing else.
     - the shirt is NEVER --home red or --away blue. Albert ruled that cards do
       not carry venue, so the art does not need those hues — and staying off
       them keeps red/blue meaning "which side is playing" everywhere else.
     - no green: green is win / odds / CTA.
     - rarity NEVER changes geometry (gate: invariance group `rarity-ladder`
       compares four different cards in the same place). Rarity reaches the art
       through one accent colour and nothing else. */

/* ------------------------------------------------------------------ *
 * Identity — the twenty people
 * ------------------------------------------------------------------ */

/* Three builds. The art lead measured the lever and it is this one: at 44px a
   head is 9.2px (21% of the canvas) while the whole figure is ~35px, so
   changing the body changes ten times more pixels than changing the hair.

   `len` runs ALONG the spine and `wide` across it, so the same numbers work on
   the keeper who is horizontal in mid-air. Head scales on its own. */
export const BUILDS = [
  { key: 'lean',   len: 1.07, wide: 0.88, head: 0.93 },
  { key: 'mid',    len: 1.00, wide: 1.00, head: 1.00 },
  { key: 'stocky', len: 0.91, wide: 1.18, head: 1.11 }
]

/* Five head silhouettes. Every one of them changes the OUTER CONTOUR of the
   head — a hairline that only shows as a texture inside the skull is invisible
   at 44px and is not on this list. */
export const HAIR = ['crop', 'afro', 'knot', 'locs', 'shaved']

/* Three skin tones. A squad is not one colour, so this is realism, not an
   index: identity is carried by contour, and this is deliberately never the
   only axis separating two cards in the same role. */
export const SKIN = ['#B07D52', '#8A5A3B', '#6B452C']

/* Hair is a FIXED near-black, not a shade of the skin it sits on. Measured:
   deriving it (skin * 0.45) put #2A1A10 hair on #5E3A24 skin, and at 44px the
   whole head was one dark blob — the silhouette survived only for the afro,
   whose disc is wider than the skull. A fixed tone keeps every hair shape
   readable on every skin tone, and the darkest skin was lifted to #6B452C so
   the pair stays separable. */
export const HAIR_COLOUR = '#1F1715'

/* Six kits, none of them --home red (#E41827), --away blue (#2F7BE8) or any
   green. `trim` is the collar and shoulder band, picked for contrast against
   its own body so the kit reads on all four card surfaces. */
export const KITS = [
  //        shirt      collar/number  shorts
  { body: '#E8EBF0', trim: '#343A45', short: '#3A4150' },   // white
  { body: '#343A45', trim: '#C9CFDA', short: '#C9CFDA' },   // charcoal
  { body: '#7D8597', trim: '#1E222A', short: '#2B313B' },   // slate
  { body: '#B9834E', trim: '#2A2016', short: '#E3E8F0' },   // ochre
  { body: '#3E5F4A', trim: '#DCE2EC', short: '#E3E8F0' },   // forest
  { body: '#6B4F63', trim: '#EADFE8', short: '#2E2833' }    // plum
]

/* The roster, as a table rather than a formula.

   It is generated from a lattice — within each role, card i takes
   build i%3, hair i%4, skin (i*2)%3 — which guarantees the worst case
   (five strikers) comes out as five distinct (build, hair) pairs. But it is
   WRITTEN OUT because Albert asked for twenty people and not "a template with
   colours swapped", and a table is the thing an art lead can hand-tune one row
   of without reasoning about a modulus. Role and pose still come from
   src/data/cards.json; only the person lives here. */
export const IDENTITY = {
  /* keepers */
  G1:  { build: 0, hair: 0, skin: 0, kit: 0 },
  G2:  { build: 1, hair: 1, skin: 2, kit: 3 },
  G3:  { build: 1, hair: 1, skin: 2, kit: 1 },
  G4:  { build: 0, hair: 0, skin: 1, kit: 4 },
  /* strikers */
  F1:  { build: 0, hair: 0, skin: 0, kit: 0 },
  F5:  { build: 1, hair: 1, skin: 2, kit: 1 },
  F7:  { build: 2, hair: 2, skin: 1, kit: 2 },
  F12: { build: 0, hair: 3, skin: 0, kit: 3 },
  F15: { build: 1, hair: 4, skin: 2, kit: 5 },
  /* playmakers */
  F2:  { build: 2, hair: 1, skin: 1, kit: 4 },
  F8:  { build: 0, hair: 2, skin: 0, kit: 5 },
  F11: { build: 1, hair: 3, skin: 2, kit: 2 },
  F16: { build: 2, hair: 0, skin: 1, kit: 1 },
  /* defenders */
  F3:  { build: 1, hair: 2, skin: 2, kit: 2 },
  F6:  { build: 2, hair: 3, skin: 1, kit: 5 },
  F9:  { build: 0, hair: 4, skin: 0, kit: 1 },
  F13: { build: 2, hair: 1, skin: 1, kit: 0 },
  /* all-rounders */
  F4:  { build: 0, hair: 1, skin: 0, kit: 2 },
  F10: { build: 2, hair: 4, skin: 1, kit: 3 },
  F14: { build: 1, hair: 0, skin: 2, kit: 4 }
}

const FALLBACK = { build: 1, hair: 0, skin: 1, kit: 2 }
export function identityOf (id) {
  const i = IDENTITY[id] || FALLBACK
  return {
    ...i,
    build: BUILDS[i.build] || BUILDS[1],
    hair: HAIR[i.hair] || HAIR[0],
    skin: SKIN[i.skin] || SKIN[1],
    kit: KITS[i.kit] || KITS[2]
  }
}

/* ------------------------------------------------------------------ *
 * Poses
 * ------------------------------------------------------------------ */

export const SKELETONS = {
  // running stride, no ball. The one pose that is only a body.
  allround: {
    label: 'Run',
    head: [40, 14], neck: [38.5, 21], pelvis: [35, 40],
    armBack:  [[34, 26], [26, 33], [21, 41]],
    armFront: [[42, 25], [52, 27], [50, 18]],
    legBack:  [[33, 41], [26, 51], [19, 61], [14, 63]],
    legFront: [[37, 41], [47, 46], [51, 57], [56, 58]],
    ball: null
  },
  // the strike. The swing leg reaches down-forward into a ball that has
  // already left the foot, so the GAP is the cue and it is held wide.
  striker: {
    label: 'Strike',
    head: [31, 15], neck: [33, 22], pelvis: [34, 41],
    armBack:  [[38, 25], [45, 31], [48, 23]],
    armFront: [[28, 26], [21, 30], [17, 24]],
    legBack:  [[31, 42], [29, 53], [28, 64], [23, 66]],
    legFront: [[37, 41], [48, 46], [55, 51], [59, 54]],
    ball: [67, 62]
  },
  // head up, ball at the near foot, free arm pointing the pass.
  playmaker: {
    label: 'Pass',
    head: [34, 14], neck: [35, 21], pelvis: [36, 40],
    armBack:  [[30, 26], [26, 34], [29, 40]],
    armFront: [[40, 25], [48, 27], [55, 24]],
    legBack:  [[39, 41], [42, 51], [41, 62], [45, 64]],
    legFront: [[33, 41], [30, 52], [28, 63], [23, 65]],
    ball: [15, 66]
  },
  // airborne clearing header. Ball ABOVE the head, legs tucked: the only pose
  // whose mass sits high.
  defender: {
    label: 'Header',
    head: [33, 19], neck: [33, 26], pelvis: [34, 43],
    armBack:  [[29, 29], [22, 32], [17, 28]],
    armFront: [[39, 29], [46, 32], [51, 28]],
    legBack:  [[31, 44], [26, 52], [29, 61], [24, 63]],
    legFront: [[38, 44], [45, 50], [49, 59], [54, 61]],
    ball: [53, 9]
  },
  // full-stretch dive. Horizontal body, ball in the top corner.
  reactive: {
    label: 'Dive',
    head: [24, 30], neck: [29, 32], pelvis: [48, 38],
    armBack:  [[29, 35], [22, 40], [16, 44]],
    armFront: [[27, 29], [18, 26], [10, 22]],
    legBack:  [[50, 41], [59, 46], [67, 51], [68, 56]],
    legFront: [[50, 36], [60, 38], [69, 41], [70, 46]],
    ball: [8, 10], gloves: true
  },
  // set stance, arms up and out. The only symmetrical pose in the set.
  commander: {
    label: 'Set',
    head: [37, 14], neck: [37, 21], pelvis: [37, 41],
    armBack:  [[30, 25], [22, 22], [16, 16]],
    armFront: [[44, 25], [52, 22], [58, 16]],
    legBack:  [[33, 42], [28, 53], [26, 64], [21, 66]],
    legFront: [[41, 42], [46, 53], [48, 64], [53, 66]],
    ball: null, gloves: true
  }
}

export const ROLES = Object.keys(SKELETONS)
export const GK_ROLES = ['reactive', 'commander']

/* ------------------------------------------------------------------ *
 * Size tiers
 * ------------------------------------------------------------------ */

/* `parts` is the whole of what gets drawn — a tier that does not list `boot`
   has no boots at all, not small ones. */
export const TIERS = {
  // 44: four tones, arms one stroke, no boots, no kit band, head relatively
  // larger because at this size the head is what says "person".
  sm: {
    size: 44, torso: 11.5, thigh: 5.4, shin: 4.4, arm: 4.2, headR: 4.6, ballR: 3.4, rim: 0.8,
    parts: ['legsplit', 'hair', 'head', 'ball']
  },
  md: {
    size: 74, torso: 15, thigh: 7.6, shin: 5, boot: 4.4, upperArm: 5.4, foreArm: 4.3,
    headR: 5.6, ballR: 5, rim: 1.1,
    parts: ['legsplit', 'armsplit', 'boot', 'band', 'hair', 'glove', 'head', 'ball']
  },
  lg: {
    size: 116, torso: 23, thigh: 11.8, shin: 7.6, boot: 7, upperArm: 8.4, foreArm: 6.6,
    headR: 8.4, ballR: 7.8, rim: 1.6,
    parts: ['backdrop', 'legsplit', 'armsplit', 'boot', 'band', 'sock', 'hair',
            'glove', 'head', 'ball', 'seam', 'number']
  }
}

/* The portrait is its own composition, so it gets its own table. Note what is
   NOT in sm: ears (3px), collar (3px), eyes. Whether eyes belong at 44 is a
   measured question, not a taste one — PORTRAIT_TIERS.smEyes exists so the two
   can be photographed side by side at true size. */
export const PORTRAIT_TIERS = {
  sm: { size: 44, rim: 0.9, parts: ['shoulder', 'neck', 'head', 'hair', 'beard'] },
  smEyes: { size: 44, rim: 0.9, parts: ['shoulder', 'neck', 'head', 'hair', 'beard', 'eyes'] },
  md: { size: 74, rim: 1.1, parts: ['shoulder', 'collar', 'neck', 'head', 'ear', 'hair', 'beard', 'eyes', 'brow'] },
  lg: { size: 116, rim: 1.5, parts: ['backdrop', 'shoulder', 'collar', 'band', 'neck', 'head', 'ear', 'hair', 'beard', 'eyes', 'brow', 'mouth'] }
}

/* ------------------------------------------------------------------ *
 * Drawing helpers
 * ------------------------------------------------------------------ */

const DARK = 'var(--fig-dark, #1E222A)'
const SHORT = 'var(--fig-short, #DCE2EC)'   // fallback only; kits carry their own
const BALL = 'var(--fig-ball, #F2F5FA)'
const RIM = 'var(--fig-rim, rgba(255,255,255,.62))'
const ACCENT = 'var(--fig-accent, #FFFFFF)'

function seg (...pts) { return 'M' + pts.map(p => r2(p[0]) + ' ' + r2(p[1])).join('L') }
function mid (a, b, t = 0.5) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] }
function r2 (n) { return +n.toFixed(2) }
function stub (ankle, toe, len = 0.8) { return [ankle, mid(ankle, toe, len)] }

/* Build transform. Decompose every joint into "along the spine" and "across
   it", scale the two independently, recompose. Doing it in body space rather
   than screen space is what lets the same three numbers describe a keeper who
   is horizontal in mid-air. The pelvis stays put; fit() cleans up after. */
function applyBuild (s, b) {
  const [nx, ny] = s.neck, [px, py] = s.pelvis
  let ax = px - nx, ay = py - ny
  const L = Math.hypot(ax, ay) || 1
  ax /= L; ay /= L
  const bx = -ay, by = ax
  const T = p => {
    const vx = p[0] - px, vy = p[1] - py
    const al = (vx * ax + vy * ay) * b.len
    const pe = (vx * bx + vy * by) * b.wide
    return [px + ax * al + bx * pe, py + ay * al + by * pe]
  }
  const lim = L => L.map((p, i) => (i === 3 ? T(p) : T(p)))
  return {
    ...s,
    head: T(s.head), neck: T(s.neck), pelvis: s.pelvis.slice(),
    armBack: lim(s.armBack), armFront: lim(s.armFront),
    legBack: lim(s.legBack), legFront: lim(s.legFront),
    ball: s.ball ? T(s.ball) : null
  }
}

/* Keep everything inside the viewBox. The gate DOES see SVG children — the
   technical lead proved it by planting an oversized circle and watching
   "content cropped by its container" go red 17 times — so this is not tidiness,
   it is the difference between green and red. Translate first, and only scale
   if translating was not enough, so a build change stays a build change
   instead of quietly turning into a zoom. */
function bbox (shapes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [tag, a] of shapes) {
    if (tag === 'circle') {
      const r = a.r + (a['stroke-width'] || 0) / 2
      x0 = Math.min(x0, a.cx - r); x1 = Math.max(x1, a.cx + r)
      y0 = Math.min(y0, a.cy - r); y1 = Math.max(y1, a.cy + r)
    } else if (a.d) {
      /* every path here is absolute M/L/C, so the numbers ARE coordinate
         pairs. Control points count too, which makes this a superset of the
         true box — erring outward is the right direction for a bounds check. */
      const half = (a['stroke-width'] || 0) / 2
      const n = a.d.match(/-?\d+(\.\d+)?/g) || []
      for (let i = 0; i + 1 < n.length; i += 2) {
        x0 = Math.min(x0, +n[i] - half); x1 = Math.max(x1, +n[i] + half)
        y0 = Math.min(y0, +n[i + 1] - half); y1 = Math.max(y1, +n[i + 1] + half)
      }
    }
  }
  return { x0, y0, x1, y1 }
}

/* Keep everything inside the viewBox. The gate DOES see SVG children — the
   technical lead proved it by planting an oversized circle and watching
   "content cropped by its container" go red seventeen times — so this is not
   tidiness, it is the difference between green and red.

   Scale first (only if the drawing is genuinely bigger than the room), then
   translate to land it. Doing it the other way round leaves a pose that is
   wider than the canvas still hanging out after the shift. */
function fit (shapes, pad = 1.5) {
  const b = bbox(shapes)
  if (!isFinite(b.x0)) return { k: 1, ox: 0, oy: 0, cx: 37, cy: 37 }
  const room = 74 - pad * 2
  const k = Math.min(1, room / Math.max(b.x1 - b.x0, b.y1 - b.y0, 0.001))
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
  const S = (v, c) => c + (v - c) * k
  let ox = 0, oy = 0
  const sx0 = S(b.x0, cx), sx1 = S(b.x1, cx), sy0 = S(b.y0, cy), sy1 = S(b.y1, cy)
  if (sx0 + ox < pad) ox = pad - sx0
  if (sx1 + ox > 74 - pad) ox = (74 - pad) - sx1
  if (sy0 + oy < pad) oy = pad - sy0
  if (sy1 + oy > 74 - pad) oy = (74 - pad) - sy1
  return { k, ox, oy, cx, cy }
}

function applyFit (shapes, f) {
  if (f.k === 1 && !f.ox && !f.oy) return shapes
  const X = x => r2(f.cx + (x - f.cx) * f.k + f.ox)
  const Y = y => r2(f.cy + (y - f.cy) * f.k + f.oy)
  return shapes.map(([tag, a, txt]) => {
    const o = { ...a }
    if (tag === 'circle') { o.cx = X(a.cx); o.cy = Y(a.cy); o.r = r2(a.r * f.k) }
    if (o.d) {
      let i = 0
      o.d = a.d.replace(/-?\d+(\.\d+)?/g, n => (i++ % 2 === 0 ? X(+n) : Y(+n)))
    }
    if (o.x != null) o.x = X(a.x)
    if (o.y != null) o.y = Y(a.y)
    if (o['stroke-width'] != null) o['stroke-width'] = r2(a['stroke-width'] * f.k)
    if (o['font-size'] != null) o['font-size'] = r2(a['font-size'] * f.k)
    if (o.transform) o.transform = null
    return txt == null ? [tag, o] : [tag, o, txt]
  })
}

/* The pale outline, as a layer of its own: the same strokes again, fatter,
   underneath. It costs no new geometry, and it is the only reason a figure in
   a dark kit survives on a dark card AND on dark grass. */
function rimOf (shapes, rimW, colour = RIM) {
  return shapes.filter(([tag]) => tag !== 'text').map(([tag, a]) => {
    if (tag === 'circle') return [tag, { ...a, r: r2(a.r + rimW / 2), fill: colour }]
    if (a['stroke-width'] != null) {
      return [tag, { ...a, 'stroke-width': r2(a['stroke-width'] + rimW), stroke: colour }]
    }
    return [tag, { ...a, fill: colour, stroke: colour, 'stroke-width': rimW, 'stroke-linejoin': 'round' }]
  })
}

/* What a <mask> wants: the same silhouette, flat white, slightly fat. The holo
   pass clips its foil to this instead of to a bitmap it cannot have. */
function maskOf (shapes, rimW) { return rimOf(shapes, rimW * 2, '#fff') }

export function flatten (layers) {
  return [...layers.bg, ...layers.rim, ...layers.body, ...layers.fg]
}

/* ------------------------------------------------------------------ *
 * Full body
 * ------------------------------------------------------------------ */

export function buildFigure (cardId, tierKey = 'lg', opts = {}) {
  const role = opts.role || ROLE_OF[cardId] || 'allround'
  const t = TIERS[tierKey]
  const id = opts.identity || identityOf(cardId)
  if (!SKELETONS[role] || !t) return { bg: [], rim: [], body: [], fg: [], mask: [] }
  const s = applyBuild(SKELETONS[role], id.build)
  const k = 74 / t.size
  const w = n => r2(n * k)
  const has = p => t.parts.includes(p)
  const gk = GK_ROLES.includes(role)
  const headR = t.headR * id.build.head

  const body = []
  const fg = []
  const bg = []
  const line = (list, d, width, colour) => list.push(['path',
    { d, stroke: colour, 'stroke-width': w(width), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none' }])
  const dot = (list, c, rr, colour) => list.push(['circle', { cx: r2(c[0]), cy: r2(c[1]), r: w(rr), fill: colour }])

  const leg = (L) => {
    const [hip, knee, ankle, toe] = L
    line(body, seg(hip, knee), t.thigh, id.kit.short || SHORT)
    line(body, seg(knee, ankle), t.shin, id.skin)
    if (has('sock')) line(body, seg(mid(knee, ankle, 0.5), mid(knee, ankle, 0.82)), t.shin * 1.06, id.kit.short || SHORT)
    if (has('boot') && toe) line(body, seg(...stub(ankle, toe)), t.boot, DARK)
  }
  const arm = (A) => {
    const [sh, el, wr] = A
    if (has('armsplit')) {
      // keepers wear the long sleeve — that plus the gloves is the keeper cue
      line(body, seg(sh, el), t.upperArm, id.kit.body)
      line(body, seg(el, wr), t.foreArm, gk ? id.kit.body : id.skin)
      if (s.gloves && has('glove')) dot(body, wr, t.foreArm * 0.70, id.kit.trim)
    } else {
      line(body, seg(sh, el, wr), t.arm, gk ? id.kit.body : id.skin)
    }
  }

  if (has('backdrop')) {
    /* A disc behind the player. It exists for the holo pass — foil needs
       something to sweep across that is not the body — and it is the one shape
       here the figure could lose without becoming unreadable, which is why it
       only appears at lg. */
    bg.push(['circle', { cx: 37, cy: 38, r: 30, fill: ACCENT, 'fill-opacity': 0.1 }])
  }

  leg(s.legBack)
  arm(s.armBack)
  line(body, seg(s.neck, s.pelvis), t.torso, id.kit.body)
  if (has('band')) {
    /* The invented kit vocabulary, in full: one chest band across the shirt,
       perpendicular to the spine, in the RARITY colour. A band and not a crest
       because a crest at 74px is four pixels of mud, and because a crest shape
       is the kind of thing somebody in the real world owns. */
    const [nx, ny] = s.neck, [px, py] = s.pelvis
    const dx = px - nx, dy = py - ny
    const L = Math.hypot(dx, dy) || 1
    const ux = -dy / L, uy = dx / L
    const c = mid(s.neck, s.pelvis, 0.34)
    const half = w(t.torso * 0.40)
    line(body, seg([c[0] - ux * half, c[1] - uy * half], [c[0] + ux * half, c[1] + uy * half]),
      t.torso * 0.20, ACCENT)
  }
  if (has('number') && opts.number != null) {
    /* The shirt number exists at 116 and nowhere else. At 74 the same digits
       are 5px and turn into two smudges — the trophy-icon lesson again. */
    const [nx, ny] = s.neck, [px, py] = s.pelvis
    const ang = Math.atan2(py - ny, px - nx) * 180 / Math.PI - 90
    const c = mid(s.neck, s.pelvis, 0.62)
    body.push(['text', {
      x: r2(c[0]), y: r2(c[1]),
      transform: `rotate(${ang.toFixed(1)} ${r2(c[0])} ${r2(c[1])})`,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': w(t.torso * 0.52), 'font-weight': 800, 'letter-spacing': '-0.04em',
      fill: id.kit.trim, stroke: 'none'
    }, String(opts.number)])
  }
  leg(s.legFront)
  arm(s.armFront)
  dot(body, s.head, headR, id.skin)
  if (has('hair')) headHair(body, s.head, w(headR), id, 1)
  if (s.ball) {
    dot(fg, s.ball, t.ballR, BALL)
    if (has('seam')) {
      const rr = w(t.ballR)
      fg.push(['path', {
        d: seg(
          [s.ball[0] - rr * 0.55, s.ball[1] - rr * 0.25],
          [s.ball[0], s.ball[1] - rr * 0.75],
          [s.ball[0] + rr * 0.55, s.ball[1] - rr * 0.25],
          [s.ball[0] + rr * 0.34, s.ball[1] + rr * 0.42],
          [s.ball[0] - rr * 0.34, s.ball[1] + rr * 0.42]) + 'Z',
        fill: DARK, 'fill-opacity': 0.72
      }])
    }
  }

  /* The rim is added after the fit, so the fit has to reserve room for it —
     otherwise a 1.6px outline is exactly what hangs out of the viewBox and
     the gate counts it as content cropped by its container. */
  const f = fit([...body, ...fg], 1.2 + w(t.rim))
  const B = applyFit(body, f), F = applyFit(fg, f)
  const rimW = w(t.rim * 2) * f.k
  return { bg: applyFit(bg, f), rim: rimOf([...B, ...F], rimW), body: B, fg: F, mask: maskOf([...B, ...F], rimW) }
}

/* ------------------------------------------------------------------ *
 * Portrait — the 44px workhorse
 * ------------------------------------------------------------------ */

/* Hair, shared by the figure's little head and the portrait's big one.
   `scale` is 1 for the figure (where hair is a cap and nothing more) and the
   portrait passes its own radius in, so one set of silhouettes serves both. */
function headHair (list, c, r, id, detail, rx = null, ry = null) {
  const [hx, hy] = c
  const RX = rx == null ? r : rx
  const RY = ry == null ? r : ry
  const dark = HAIR_COLOUR
  /* A cap that follows the skull from a chord at `t` of the way up, written as
     two ABSOLUTE cubics. Absolute, and M/L/C only, for two reasons that happen
     to agree: twenty shapes sharing one command set is what actually
     compresses (the technical lead measured 74% of naive x20), and a path made
     only of absolute coordinate pairs has a bounding box you can compute by
     reading the numbers — which is how the viewBox check below stays honest. */
  const cap = (t = 0.22) => {
    const yc = hy - RY * t
    const hw = RX * Math.sqrt(Math.max(1 - t * t, 0.02))
    const top = hy - RY
    const dy = (yc - top) * 0.55
    /* The return edge is a CURVE that dips at the centre, not a straight
       chord. Measured at 44px: a straight hairline reads as a headband — the
       eye takes a horizontal line across a face as an object, not as an
       absence of hair. The dip is 0.13 of the head height, about 2px at 44. */
    return `M${r2(hx - hw)} ${r2(yc)}C${r2(hx - RX * 0.98)} ${r2(yc - dy)} ${r2(hx - RX * 0.62)} ${r2(top)} ${r2(hx)} ${r2(top)}` +
           `C${r2(hx + RX * 0.62)} ${r2(top)} ${r2(hx + RX * 0.98)} ${r2(yc - dy)} ${r2(hx + hw)} ${r2(yc)}` +
           `C${r2(hx + hw * 0.55)} ${r2(yc + RY * 0.17)} ${r2(hx - hw * 0.55)} ${r2(yc + RY * 0.17)} ${r2(hx - hw)} ${r2(yc)}Z`
  }
  switch (id.hair) {
    case 'afro':
      // the biggest contour change available: a disc wider than the skull
      list.push(['circle', { cx: r2(hx), cy: r2(hy - RY * 0.56), r: r2(RX * 1.02), fill: dark }])
      break
    case 'knot':
      list.push(['path', { d: cap(0.16), fill: dark }])
      list.push(['circle', { cx: r2(hx), cy: r2(hy - RY * 1.02), r: r2(RX * 0.28), fill: dark }])
      break
    case 'locs':
      list.push(['path', { d: cap(0.16), fill: dark }])
      // sat at ear height in the first pass and read as ears; dropped and
      // fattened so the mass reads as hair volume instead
      list.push(['circle', { cx: r2(hx - RX * 0.90), cy: r2(hy + RY * 0.34), r: r2(RX * 0.30), fill: dark }])
      list.push(['circle', { cx: r2(hx + RX * 0.90), cy: r2(hy + RY * 0.34), r: r2(RX * 0.30), fill: dark }])
      break
    case 'shaved':
      // no shape at all. A bald contour IS a silhouette, and it is the only
      // one in the set with nothing above the skull line.
      break
    default:
      list.push(['path', { d: cap(0.30), fill: dark }])
  }
  if (detail > 1 && id.beard) {
    /* A crescent that follows the jaw, with the top edge bowing DOWN in the
       middle so the mouth stays bare. The first version had a straight top
       edge and read as a bar across the face at 44px — same failure as the
       straight hairline, for the same reason. */
    list.push(['path', {
      d: `M${r2(hx - RX * 0.82)} ${r2(hy + RY * 0.22)}` +
         `C${r2(hx - RX * 0.80)} ${r2(hy + RY * 0.82)} ${r2(hx - RX * 0.42)} ${r2(hy + RY * 1.0)} ${r2(hx)} ${r2(hy + RY * 1.0)}` +
         `C${r2(hx + RX * 0.42)} ${r2(hy + RY * 1.0)} ${r2(hx + RX * 0.80)} ${r2(hy + RY * 0.82)} ${r2(hx + RX * 0.82)} ${r2(hy + RY * 0.22)}` +
         `C${r2(hx + RX * 0.58)} ${r2(hy + RY * 0.64)} ${r2(hx - RX * 0.58)} ${r2(hy + RY * 0.64)} ${r2(hx - RX * 0.82)} ${r2(hy + RY * 0.22)}Z`,
      fill: dark
    }])
  }
}

/* Darken / lighten a hex. Used only for hair and beard against their own skin
   tone, so the two never collide on a dark-skinned card. */
function shade (hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v =>
    Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt))))
  return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('')
}

export function buildPortrait (cardId, tierKey = 'sm', opts = {}) {
  const t = PORTRAIT_TIERS[tierKey]
  const id = { ...identityOf(cardId), ...(opts.identity || {}) }
  if (!t) return { bg: [], rim: [], body: [], fg: [], mask: [] }
  const has = p => t.parts.includes(p)
  const b = id.build
  /* Beard is derived, not stored: it is a second contour axis for free, and
     deriving it keeps IDENTITY to the four things an art lead would want to
     edit. */
  id.beard = (HAIR.indexOf(id.hair) + BUILDS.indexOf(b)) % 2 === 1

  const cx = 37
  const headCy = 28.5
  /* every shape is held inside this inset, rim included */
  const inset = r2(1.2 + (74 / t.size) * t.rim)
  const rx = 16.2 * b.wide
  /* a wide build is also a SHORTER face, not just a wider one — scaling both
     axes together is a zoom, and a zoom is not a different person */
  const ry = 18.4 * (2 - b.wide) * 0.5 + 9.2
  const bg = [], body = [], plate = [], plateRim = []

  // the backdrop is a holo target, so it is as big as the canvas allows and
  // not a pixel more — bg is not part of fit(), it is clamped here
  if (has('backdrop')) bg.push(['circle', { cx, cy: 37, r: r2(37 - inset), fill: ACCENT, 'fill-opacity': 0.1 }])

  if (has('shoulder')) {
    /* The shoulders are CROPPED BY THE CANVAS EDGE, not by overflow: the
       bottom edge is flat and lands exactly on the inset, because the gate
       reads an SVG child's un-clipped geometry — the technical lead planted an
       oversized circle and got "content cropped by its container" seventeen
       times. A bust that bleeds would be red. It still reads as a crop because
       the dome is far wider than it is tall. */
    const sw = Math.min(35 * b.wide, 37 - inset)
    const base = 74 - inset
    const dome = `M${r2(cx - sw)} ${r2(base)}` +
      `C${r2(cx - sw)} ${r2(60 - 3 * b.len)} ${r2(cx - sw * 0.55)} 53 ${cx} 53` +
      `C${r2(cx + sw * 0.55)} 53 ${r2(cx + sw)} ${r2(60 - 3 * b.len)} ${r2(cx + sw)} ${r2(base)}`
    plateRim.push(['path', {
      d: dome, fill: 'none', stroke: RIM,
      'stroke-width': r2((74 / t.size) * t.rim * 2), 'stroke-linejoin': 'round'
    }])
    plate.push(['path', { d: dome + 'Z', fill: id.kit.body }])
  }
  if (has('neck')) {
    body.push(['path', {
      d: seg([cx, headCy + ry * 0.55], [cx, Math.min(57, 74 - inset)]),
      stroke: shade(id.skin, -0.18), 'stroke-width': r2(13 * b.wide), 'stroke-linecap': 'butt', fill: 'none'
    }])
  }
  if (has('collar')) {
    plate.push(['path', {
      d: `M${r2(cx - 9.5)} 54L${cx} ${r2(Math.min(63, 74 - inset))}L${r2(cx + 9.5)} 54Z`, fill: id.kit.trim
    }])
  }
  if (has('band')) {
    // the shoulder band, rarity colour, same vocabulary as the full body
    plate.push(['path', {
      d: seg([r2(cx - 30 * b.wide + 4), r2(68 - inset)], [r2(cx - 30 * b.wide + 17), r2(64 - inset)]),
      stroke: ACCENT, 'stroke-width': 4.4, 'stroke-linecap': 'round', fill: 'none'
    }])
  }
  if (has('ear')) {
    body.push(['circle', { cx: r2(cx - rx * 0.97), cy: r2(headCy + ry * 0.12), r: 3.4, fill: shade(id.skin, -0.12) }])
    body.push(['circle', { cx: r2(cx + rx * 0.97), cy: r2(headCy + ry * 0.12), r: 3.4, fill: shade(id.skin, -0.12) }])
  }
  if (has('head')) {
    body.push(['path', {
      /* A narrowed chin, not a plain ellipse: an egg makes every build the
         same width at the jaw, and the jaw is exactly where a stocky head
         should differ most. */
      d: `M${cx} ${r2(headCy - ry)}` +
         `C${r2(cx + rx * 0.58)} ${r2(headCy - ry)} ${r2(cx + rx)} ${r2(headCy - ry * 0.55)} ${r2(cx + rx)} ${r2(headCy - ry * 0.05)}` +
         `C${r2(cx + rx)} ${r2(headCy + ry * 0.45)} ${r2(cx + rx * 0.52)} ${r2(headCy + ry)} ${cx} ${r2(headCy + ry)}` +
         `C${r2(cx - rx * 0.52)} ${r2(headCy + ry)} ${r2(cx - rx)} ${r2(headCy + ry * 0.45)} ${r2(cx - rx)} ${r2(headCy - ry * 0.05)}` +
         `C${r2(cx - rx)} ${r2(headCy - ry * 0.55)} ${r2(cx - rx * 0.58)} ${r2(headCy - ry)} ${cx} ${r2(headCy - ry)}Z`,
      fill: id.skin
    }])
  }
  if (has('hair')) headHair(body, [cx, headCy], 0, id, has('beard') ? 2 : 1, rx, ry)
  if (has('eyes')) {
    const ey = headCy + ry * 0.1
    const ex = rx * 0.42
    body.push(['circle', { cx: r2(cx - ex), cy: r2(ey), r: r2(rx * 0.14), fill: '#20242C' }])
    body.push(['circle', { cx: r2(cx + ex), cy: r2(ey), r: r2(rx * 0.14), fill: '#20242C' }])
  }
  if (has('brow')) {
    const by = headCy - ry * 0.14
    const ex = rx * 0.44
    const bw = rx * 0.30
    body.push(['path', {
      d: `${seg([cx - ex - bw, by], [cx - ex + bw, by - 1])}${seg([cx + ex - bw, by - 1], [cx + ex + bw, by])}`,
      stroke: shade(id.skin, -0.5), 'stroke-width': 2.4, 'stroke-linecap': 'round', fill: 'none'
    }])
  }
  if (has('mouth')) {
    body.push(['path', {
      d: seg([cx - rx * 0.26, headCy + ry * 0.62], [cx + rx * 0.26, headCy + ry * 0.62]),
      stroke: shade(id.skin, -0.42), 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none'
    }])
  }

  const rimW = (74 / t.size) * t.rim * 2
  const f = fit([...plate, ...body], inset)
  const PR = applyFit(plateRim, f)
  const P = applyFit(plate, f)
  const B = applyFit(body, f)
  return {
    bg: applyFit(bg, f),
    rim: [...PR, ...rimOf(B, rimW)],   // the bust's dome, then head and hair
    body: [...P, ...B],
    fg: [],
    mask: maskOf([...P, ...B], rimW)
  }
}

/* role lookup, filled by the app from src/data/cards.json so this module stays
   importable on its own (the preview tools do exactly that). */
export const ROLE_OF = {}
export function setRoles (cards) { cards.forEach(c => { ROLE_OF[c.id] = c.role }) }
