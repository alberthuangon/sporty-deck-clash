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
  /* The pentagon is FILLED and half the ball's radius, with five radial
     seams. Drawn as an outline at a third that size it closed up into a dot
     at 19px and the whole icon read as a crosshair. Takes stroke 1.5 rather
     than 1.8 — eleven strokes at 1.8 merge at this size — and the fill is held
     at 0.55 so the one solid shape in a row of outlines carries about the same
     ink as the strokes beside it. */
  play: [
    ['circle', { cx: 12, cy: 12, r: 8.5 }],
    ['path', { d: 'M12 7.8 16 10.7 14.47 15.4 9.53 15.4 8 10.7Z', fill: 'currentColor', 'fill-opacity': 0.55, stroke: 'none' }],
    ['path', { d: 'M12 7.8V3.5M16 10.7l4.08-1.33M14.47 15.4l2.52 3.48M9.53 15.4l-2.52 3.48M8 10.7L3.92 9.37' }]
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
  /* A podium, not a trophy. A trophy's handles are about 1.8px wide at the
     size this is drawn, so they vanish whatever you do to them, and a cup
     without handles is a wine glass. Three bars have no detail to lose — and
     "placing" is what the screen is actually about. */
  rank: [
    ['rect', { x: 3.5, y: 13.5, width: 5.6, height: 6.5, rx: 1 }],
    ['rect', { x: 9.2, y: 9, width: 5.6, height: 11, rx: 1 }],
    ['rect', { x: 14.9, y: 15.5, width: 5.6, height: 4.5, rx: 1 }]
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
