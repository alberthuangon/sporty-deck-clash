/* Albert's illustrations. Twenty players, two pictures each.

   There is no fallback any more. There was one while the set was arriving —
   artFor() returned null and the card fell back to a generated SVG — and the
   drawings and the fallback went together, because a fallback nobody can
   reach is a branch that rots. What replaces it is the check at the bottom of
   this file: every card in the catalogue must have both pictures.

   Imported rather than fetched. The app has one hard rule about assets — no
   external CDN, everything in the bundle — and import.meta.glob satisfies it
   by handing the files to the bundler, which emits them into dist/assets/
   under content-hashed names and rewrites these URLs to point at them. They
   are same-origin and work with the network unplugged. (The earlier rule in
   this project's notes, "no image files at all", was a misreading of that
   one; measured: a 10,928-byte PNG lands in dist/assets/ and index.html
   still references everything with ./assets/.) */
import CARDS from '../data/cards.json'

const FIG = import.meta.glob('../assets/player-art/*-figure.webp', { eager: true, query: '?url', import: 'default' })
const POR = import.meta.glob('../assets/player-art/*-portrait.webp', { eager: true, query: '?url', import: 'default' })

const keyed = (mod, suffix) => Object.fromEntries(
  Object.entries(mod).map(([path, url]) => [path.split('/').pop().replace(suffix, ''), url]))

export const FIGURES = keyed(FIG, '-figure.webp')
export const PORTRAITS = keyed(POR, '-portrait.webp')

/* The INTRINSIC size, written onto every <img> as width/height attributes.
   Not decoration: an <img> with no intrinsic ratio is a zero-height box until
   it loads, and then everything below it drops. The layout gate asserts this
   (`images that reserve no space`) precisely because it cannot photograph the
   moment it goes wrong — every state is measured after the page settles.

   384, not 160. The portraits were cut for a 44px circle in a stacked grid
   cell; the cell is a full-bleed 130x182 card now, and object-fit: cover
   fits a SQUARE source to the cell's HEIGHT before cropping it sideways — so
   the number to beat is 182, not the 130 it looks like, and the old file was
   being asked to cover 182 with 160. Rebuilt from the 1254px masters by
   tools/art/portraits.mjs. These two numbers are a claim about what is on
   disk, so the layout gate checks them against the files themselves rather
   than taking this line's word for it. */
export const ART_BOX = { figure: [640, 896], portrait: [384, 384] }

/* WHERE TO AIM A CROP, for the few that need aiming.

   The portraits are square and the collection grid is 5:7, so the browser
   throws away 14.3% of the width from each side. That is the right default:
   nineteen of the twenty are composed centrally enough that a symmetric cut
   takes background and hair that was already running off the frame, and the
   face lands where it should. Checked by looking at all twenty cropped, not
   by a rule.

   F15 is the exception and it is a composition fact rather than a near miss:
   he is shouting with his head thrown back and to his right, so the subject's
   mass sits left of the square's centre. A symmetric cut pushes his beard
   into the right edge while cutting the dreadlocks on the left — the one
   player the default gets wrong at both edges at once. 35% aims the window at
   him instead of at the picture.

   Not a crop baked into the file. The export stays square (tools/art), so
   this is one number to revisit if the cell's shape ever changes, rather than
   twenty images to re-cut. */
export const ART_FOCUS = { F15: '35% center' }

export function artFor (cardId, kind) {
  return (kind === 'figure' ? FIGURES : PORTRAITS)[cardId] || null
}

/* Said out loud at startup rather than discovered as an empty box on one
   screen in one state. This is a convenience for whoever is running the app,
   NOT the enforcement — deleting a file and watching the gate stay green is
   how that was settled: the message fires once while this module loads,
   before the harness is listening to any state. The enforcement is
   `cards with no picture on disk` in tools/layout, which reads the directory
   instead of the screen. console.error and not throw, because a player with
   a half-built bundle should still get a game they can finish. */
const missing = CARDS.cards.flatMap(c => [
  FIGURES[c.id] ? null : `${c.id}-figure.webp`,
  PORTRAITS[c.id] ? null : `${c.id}-portrait.webp`
]).filter(Boolean)
if (missing.length) {
  console.error(`player art missing for ${missing.length} file(s): ${missing.join(', ')}`)
}
