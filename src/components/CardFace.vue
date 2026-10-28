<template>
  <div class="cf" :class="[`r-${card.rarity}`, size, { sel: selected, dim: dim, 'cf-full': full }]">
    <div class="cf-top">
      <span class="cf-rar">{{ card.rarity }}</span>
      <span class="cf-pos">{{ roleCode }}</span>
      <span class="cf-lv">Lv.{{ card.level }}</span>
    </div>
    <div class="cf-art">
      <PlayerArt v-if="radar" :card-id="card.id" kind="portrait" :tier="size" :rarity="card.rarity" />
      <PlayerArt v-else-if="size === 'lg'" :card-id="card.id" kind="figure" tier="lg"
                 :rarity="card.rarity" :number="shirtNo" eager :fill="full" />
      <div v-else class="cf-mono">{{ initials }}</div>
    </div>
    <!-- A real element, not ::after. The scrim is what makes the name legible
         over the picture, so it is doing a job rather than decorating — and a
         pseudo-element is invisible to every assertion in the layout gate,
         which is exactly the wrong place to put something load-bearing. -->
    <i v-if="full" class="cf-scrim" aria-hidden="true"></i>
    <div class="cf-name">{{ card.name }}</div>
    <!-- the venue span is ALWAYS rendered, empty for a neutral card. Measured:
         an empty one is 0x11, which is not a zero box, so it takes an anchor in
         the invariance groups — making it a v-if would drop that anchor for the
         six neutral cards only, and shift every later anchor index with it. -->
    <div class="cf-role">{{ roleLabel }}<span class="cf-venue" :class="card.venue">{{ venueMark }}</span></div>
    <!-- THE WHOLE CARD, not the art box. The earlier version hung these inside
         .cf-art precisely so their rectangle could never reach the name — a
         layer's box is decided by which parent it hangs from, not by what it
         paints, and getBoundingClientRect ignores masks and clipping alike.
         That was the right answer while the foil was clipped to a silhouette.
         A full-card finish has no such box to hide in: it is over the name and
         the rarity stamp by definition, so the gate has to be able to tell a
         compositing layer from an occluding one instead. It now can — see
         `content partly hidden behind something on top of it` in tools/layout.
         Both layers render for every rarity, varying only in what they paint:
         a conditional element would change the anchor indices of a Common
         against a Legendary and walk the rarity-ladder group. -->
    <template v-if="foil">
      <i class="cf-foil" aria-hidden="true"></i>
      <i class="cf-gloss" aria-hidden="true"></i>
    </template>
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import PlayerArt from './PlayerArt.vue'
import { ROLE_LABEL } from '../engine/cards.js'

/* Two-letter stamp per role. Lives here rather than beside ROLE_LABEL in
   src/engine/cards.js because the engine is off limits this pass, and the card
   face is the only thing that wants it — a shared module for one consumer is
   a module nobody needs yet. */
const ROLE_CODE = {
  striker: 'ST', playmaker: 'PM', defender: 'DF',
  allround: 'AR', reactive: 'SS', commander: 'CM'
}

const props = defineProps({
  card: { type: Object, required: true },
  size: { type: String, default: 'md' },       // sm | md | lg
  radar: { type: Boolean, default: true },
  /* the laminated finish. Off in the 44px grid on purpose: twenty cards
     shimmering at once is noise, and that screen's job is finding a card */
  foil: { type: Boolean, default: false },
  selected: Boolean,
  dim: Boolean
})
/* sm is 44 rather than 54: the 3-column cell is 104px tall and 54 would make
   the card's own content 109, growing every row in the grid. */
const artSize = computed(() => ({ sm: 44, md: 74, lg: 116 }[props.size]))
/* EVERY lg card, not only the ones with a picture, and the gate is what
   settled that. Switching shape per card was the obvious first cut — one of
   twenty is illustrated, so give that one the 5:7 treatment and leave the
   rest alone — and `elements that move between states of one screen` reported
   11 shifts across packopen-reveal immediately: the reveal showed F1 at 266px
   and the next card at 185px, so the name, the verdict and the Next button
   all jumped 81px between two taps of the same button. A card's geometry may
   not depend on WHICH card it is; that is the same claim rarity-ladder makes
   about rarity. So the frame is 5:7 for all of them and the content inside it
   varies: a photograph where there is one, the drawing where there is not,
   scaled to fit the same box. The 44px grid keeps the old stacked rows — its
   cells are sized by the locked placeholders, and that ladder has to turn
   over all at once or the rows go ragged. */
const full = computed(() => props.size === 'lg' && !props.radar)
const initials = computed(() => props.card.name.slice(0, 2).toUpperCase())
const shirtNo = computed(() => (props.card.seed % 29) + 1)

const roleLabel = computed(() => ROLE_LABEL[props.card.role])
const roleCode = computed(() => ROLE_CODE[props.card.role] || '')
const venueMark = computed(() =>
  props.card.venue === 'home' ? 'H' : props.card.venue === 'away' ? 'A' : '')
</script>

<style scoped>
/* Rarity owns the card's SURFACE, not just its edge. Four steps, and three
   channels climb together — hue, top-left brightness, and glow radius
   (0 -> 10 -> 16 -> 22px) — so the ladder survives a colour-blind viewer and a
   projector that mangles hue. E and L add a fourth channel that costs no
   layout at all: texture. */
.cf {
  position: relative;
  background: var(--cf-body);
  border: 1px solid var(--cf-edge, var(--rc, var(--divider)));
  border-radius: var(--r-md);
  box-shadow: var(--cf-shadow);
  padding: 6px 6px 8px;
  display: flex; flex-direction: column; align-items: center;
  overflow: hidden;
}
.cf::before {
  content: ''; position: absolute; inset: 0 0 auto; height: 3px;
  background: var(--rc, var(--divider));
  z-index: 2;
}
/* Decoration only — texture, corner bloom, foil. Never anything the player has
   to read: a pseudo-element is invisible to every assertion in the layout gate,
   so it cannot be caught covering, cropping or shrinking content. Kept under
   the content layers (z-index 0 against their 1) and well under opaque: the
   heaviest single stop here is 0.38. */
.cf::after {
  content: ''; position: absolute; inset: 0;
  pointer-events: none; z-index: 0;
  border-radius: inherit;
  background: var(--cf-deco, none);
}
.cf-top, .cf-art, .cf-name, .cf-role { position: relative; z-index: 1; }

/* the four rarity steps (--rc / --cf-body / --cf-shadow / --cf-deco /
   --radar-c / --radar-fill) are defined in src/styles/tokens.css, because the
   locked placeholders and the detail radar carry the same r-<rarity> class */
/* Selected overrides the rarity GLOW but keeps the rarity border, so a chosen
   Legendary reads as a gold frame inside a mint ring — mint is not any rarity
   colour, so the two signals cannot be confused for one another. */
.cf.sel { box-shadow: 0 0 0 2px var(--cta), 0 0 14px rgba(51,234,106,.45); }
/* Dimmed means "already placed elsewhere", not "unknown": the glow goes, the
   rarity colour stays readable. */
.cf.dim { opacity: .45; box-shadow: 0 1px 3px rgba(0,0,0,.35); }

.cf-top {
  width: 100%; display: flex; justify-content: space-between; align-items: center;
  font-size: 9px; font-weight: 700; margin-top: 2px;
}
.cf-rar {
  background: var(--rc); color: var(--on-rarity); border-radius: 3px;
  padding: 0 4px; line-height: 13px;
}
/* The position stamp is the third child of a row that was already a flex row
   with <=13px children, so it costs this row no height at all. Deliberately
   neutral grey: the product already spends three colour families on meaning
   (rarity, home/away, win/loss), and a fourth would dilute all three. Role
   gets shape and letters; rarity keeps the colour. */
.cf-pos {
  font-size: 8px; font-weight: 800; letter-spacing: .08em;
  color: #D4D8E0;
  border: 1px solid var(--divider);
  border-radius: var(--r-sm);
  padding: 0 4px; line-height: 11px;
}
/* The top row sits on the gradient's BRIGHT corner, where --text-2 measures
   3.73 / 3.97 / 3.80 / 2.80 against the four bodies — all under AA, worst on
   Legendary. The role line below is on the dark end and measures 5.0+, so it
   keeps --text-2. */
.cf-lv { color: #D4D8E0; }
/* flex: 1 so a card stretched by its grid cell grows around the art rather
   than leaving a gap under the role line */
.cf-art { position: relative; display: flex; flex: 1; align-items: center; justify-content: center; margin: 2px 0; }
/* z-index 3, over everything including the rarity bar at 2 and the four
   content layers at 1 — a laminate is the outermost thing on a real card, and
   a finish that stops politely at the edge of the artwork is a sticker.
   Both carry mix-blend-mode, pointer-events: none and no background-colour,
   which is exactly the three-part test the gate uses to tell a compositing
   layer from one that is hiding something. */
.cf-foil, .cf-gloss {
  position: absolute; inset: 0;
  pointer-events: none;
  border-radius: inherit;
  z-index: 3;
  opacity: var(--holo-on, 0);
}
/* The foil travels WITH the light. */
/* 100%, not more. The foil gradient does not repeat, so background-size is
   really "how much of the rainbow fits in the box": at 240% the card showed a
   2.4x-stretched slice and the foil's own hue spread measured 0.043 — a
   single-colour wash wearing a rainbow's name. At 100% the whole sweep lands
   inside the box and it measures 0.314, seven times the variety, with the
   same colours and the same alpha. */
.cf-foil {
  background: var(--holo-foil, none);
  background-size: 100% 100%;
  background-position: var(--holo-x, 50%) var(--holo-y, 50%);
  mix-blend-mode: color-dodge;
}
/* The gloss travels AGAINST it. A highlight that follows the pointer reads as
   a sticker on the card; a reflection moves the other way as the card turns,
   which is why the position is inverted rather than shared. */
.cf-gloss {
  background: var(--holo-back, none), var(--holo-gloss);
  background-size: 240% 240%, 240% 240%;
  background-position:
    calc(100% - var(--holo-x, 50%)) calc(100% - var(--holo-y, 50%)),
    calc(100% - var(--holo-x, 50%)) calc(100% - var(--holo-y, 50%));
  mix-blend-mode: overlay;
}
/* only the lg detail card still shows initials; it reads as a rarity-coloured
   monogram rather than the grey repeat of the name directly under it */
/* THE PICTURE DECIDES NOTHING ABOUT THE SHAPE. The card sets 5:7 and the art
   fills it; the alternative — letting each image size its own card — would
   make a card's geometry depend on which card it is, and the rarity-ladder
   group exists to assert exactly that it does not.

   Type scales with the card, because the safe areas the illustration was
   drawn against are percentages. 130px in a grid cell and 320px at the pack
   reveal is a 2.5x range, and a fixed 12px name would sit in a different
   place in the composition at each end. cqw against .cf itself, so one
   container drives all three rows. */
.cf.cf-full {
  aspect-ratio: 5 / 7;
  container-type: inline-size;
  padding: 0;
  display: block;
}
.cf-full .cf-art { position: absolute; inset: 0; margin: 0; display: block; }
.cf-full .cf-art .pa { width: 100%; height: 100%; }
/* The SVG stand-ins keep their own proportions inside the taller frame —
   preserveAspectRatio defaults to meet, so a 74-square drawing is centred
   rather than stretched into a 5:7 person. */
.cf-full .cf-top {
  position: absolute; inset: 0 0 auto; z-index: 2;
  padding: 3.6cqw 4cqw 0; font-size: 5cqw;
}
.cf-full .cf-rar, .cf-full .cf-lv { font-size: 5cqw; }
.cf-full .cf-rar { padding: 0.6cqw 1.8cqw; border-radius: 1.4cqw; }
.cf-full .cf-pos { font-size: 4.6cqw; padding: 0.4cqw 1.6cqw; }
.cf-full .cf-name {
  /* 10.8, not 8.4: the role line below it is 5.4cqw of type on a 1.2 line
     box and sits 3cqw off the bottom, so anything under 9.5 puts the name
     ON it. Nothing in the gate catches that — `content partly hidden`
     compares paint layers, and two siblings at the same z-index are not
     above or below each other. Measured the only way it can be: by looking. */
  position: absolute; left: 0; right: 0; bottom: 10.8cqw; z-index: 2;
  font-size: 7.4cqw; line-height: 1.1;
}
.cf-full .cf-role {
  position: absolute; left: 0; right: 0; bottom: 3cqw; z-index: 2;
  font-size: 5.4cqw; line-height: 1.2;
}
.cf-full .cf-venue.home, .cf-full .cf-venue.away { padding: 0 0.9cqw; }
/* Only as tall as the type it carries, and transparent for most of that: the
   bottom fifth is where the name lives and the picture's own safe area is. */
.cf-scrim {
  position: absolute; left: 0; right: 0; bottom: 0; height: 32%;
  z-index: 1; pointer-events: none;
  background: linear-gradient(to top, rgba(8,10,14,.92) 0%, rgba(8,10,14,.72) 38%, rgba(8,10,14,0) 100%);
}
.cf-mono { font-size: 22px; font-weight: 800; color: var(--rc); opacity: .9; }
.cf-name { font-size: 12px; font-weight: 700; line-height: 1.2; text-align: center; }
.cf-role { font-size: 9px; color: var(--text-2); text-align: center; }
/* A jersey swatch, not just a tinted letter: --away (#2F7BE8) and --r-r
   (#4C9BFF) are close enough that a Rare Away card would be blue text in a
   blue frame, so the two are told apart by SHAPE. Same swatch vocabulary the
   scoreboard, the cut-in and the shootout already use.
   inline-flex is scoped to the two real venues on purpose: a neutral card's
   span must stay a 0x11 inline box, because that is the box the gate's
   invariance anchors were measured against. */
/* A NEUTRAL BADGE, in the same family as .cf-pos, and the colour it used to
   spend is the point of the change.

   It was a solid --home / --away swatch, which put a team colour on the card
   face — and the Rare foil is a sheet of --r-r (#4C9BFF) colour-dodged across
   the whole card, with --away (#2F7BE8) a near neighbour of it. Two of the
   three semantic colour families on one card, one of them painted edge to
   edge by the finish. The information stays: .cf-venue is not which team the
   player belongs to, it is where he plays better (engine: home HOM 20 / AWY
   16), and that is real. Only the encoding changes, to the one .cf-pos
   already argued for — role takes shape and letters, rarity takes colour.
   --home and --away keep the places where they genuinely mean two teams: the
   scoreboard, the goal cut-in, the shootout.

   box-shadow, not border, and no vertical padding. A border on an inline box
   adds to the line, and this line's height is load-bearing: an inline-flex
   swatch made it 0.6px taller on a home/away card than on a neutral one,
   which walked the four rows beneath it and failed packopen-reveal. A
   box-shadow ring costs no layout at all, so a neutral card's empty span is
   still exactly the box the invariance anchors were measured against. */
.cf-venue { position: relative; margin-left: 4px; font-weight: 800; }
.cf-venue.home, .cf-venue.away {
  color: #D4D8E0;
  padding: 0 3px;
  border-radius: var(--r-sm);
  box-shadow: inset 0 0 0 1px var(--divider);
}
.sm .cf-name { font-size: 11px; }
.lg .cf-name { font-size: 16px; }
.lg .cf-role { font-size: 11px; }
.lg .cf-mono {
  font-size: 34px; font-weight: 900; letter-spacing: .04em;
  text-shadow: 0 2px 10px rgba(0,0,0,.45);
}
</style>
