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
   moment it goes wrong — every state is measured after the page settles. */
export const ART_BOX = { figure: [640, 896], portrait: [160, 160] }

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
