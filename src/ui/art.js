/* Albert's illustrations, and the fallback while there is only one of them.

   The SVG player in figures.js is not deleted yet and must not be: there are
   twenty cards and one asset, so every screen still has to render the other
   nineteen. artFor() returning null IS the fallback switch — a card with a
   real picture gets it, a card without one keeps the drawing, and no screen
   has to know which is which.

   Imported rather than fetched. The app has one hard rule about assets — no
   external CDN, everything in the bundle — and import.meta.glob satisfies it
   by handing the files to the bundler, which emits them into dist/assets/
   under content-hashed names and rewrites these URLs to point at them. They
   are same-origin and work with the network unplugged. (The earlier rule in
   this project's notes, "no image files at all", was a misreading of that
   one; measured: a 10,928-byte PNG lands in dist/assets/ and index.html
   still references everything with ./assets/.) */
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
