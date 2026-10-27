/* The app's line icons — guide §10 step 7 item 4.

   These replace emoji, and the reason is harder than taste: emoji are rendered
   by the PLATFORM. This build gets handed round on whatever phones and laptops
   are in the room, and 🧾 and 🃏 in particular look nothing alike across
   Android, iOS and Windows, so the tab bar would be a different tab bar for
   every person who opened it. A path is a path everywhere.

   Shapes rather than markup strings: the Icon component builds real elements
   from these, so nothing in the app has to use v-html — which also means the
   layout gate sees each icon as the box it really is. Every icon is drawn on
   the same 24x24 grid and strokes in currentColor, so it inherits whatever
   colour and glow the thing around it already had. */

export const ICONS = {
  /* ---- tab bar ---- */
  cards: [
    ['rect', { x: 3, y: 6, width: 11, height: 15, rx: 2, transform: 'rotate(-10 8.5 13.5)' }],
    ['rect', { x: 10, y: 4, width: 11, height: 15, rx: 2 }]
  ],
  shop: [
    ['path', { d: 'M5 8h14l-1 12H6L5 8z' }],
    ['path', { d: 'M9 8V6a3 3 0 0 1 6 0v2' }]
  ],
  play: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z' }]
  ],
  missions: [
    ['rect', { x: 5, y: 4, width: 14, height: 17, rx: 2 }],
    ['path', { d: 'M9 4h6v2.5H9z' }],
    ['path', { d: 'M8.8 13l2.2 2.2 4.2-4.4' }]
  ],
  history: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M12 7v5.3l3.4 2' }]
  ],
  rank: [
    ['path', { d: 'M8 4h8v5a4 4 0 0 1-8 0V4z' }],
    ['path', { d: 'M8 5.5H5.5V7a3 3 0 0 0 3 3' }],
    ['path', { d: 'M16 5.5h2.5V7a3 3 0 0 1-3 3' }],
    ['path', { d: 'M12 13v3.5M9 20h6' }]
  ],

  /* ---- glyphs used inline in the screens ---- */
  lock: [
    ['rect', { x: 5, y: 10.5, width: 14, height: 10, rx: 2 }],
    ['path', { d: 'M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3' }]
  ],
  ticket: [
    ['path', { d: 'M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.6a2 2 0 0 0 0 3.8v1.6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.6a2 2 0 0 0 0-3.8V8.5z' }],
    ['path', { d: 'M14 7.5v9', 'stroke-dasharray': '2 2' }]
  ],
  diamond: [
    ['path', { d: 'M12 3.2l6.4 8.8L12 20.8 5.6 12z' }]
  ]
}
