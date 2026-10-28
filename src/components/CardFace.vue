<template>
  <div class="cf" :class="[`r-${card.rarity}`, size, { sel: selected, dim: dim, 'cf-full': full, locked }]">
    <div class="cf-top">
      <span class="cf-rar">{{ card.rarity }}</span>
      <span class="cf-pos">{{ roleCode }}</span>
      <!-- empty, not absent, on a locked card: there is no level to show for
           a card nobody owns, and `Lv.1` is a specific false claim rather
           than a harmless default. The span stays so the owned card beside
           it keeps the same anchors. -->
      <span class="cf-lv">{{ locked ? '' : 'Lv.' + card.level }}</span>
    </div>
    <div class="cf-art">
      <PlayerArt v-if="full" :card-id="card.id" :kind="artKind" :tier="size"
                 :rarity="card.rarity" :number="shirtNo" :eager="size === 'lg'" fill />
      <PlayerArt v-else-if="radar" :card-id="card.id" kind="portrait" :tier="size" :rarity="card.rarity" />
      <div v-else class="cf-mono">{{ initials }}</div>
    </div>
    <!-- Not owned. Three channels say so and they are deliberately not the
         same channel rarity uses: the edge goes dashed, the glow goes, and a
         flat dark layer sits over the picture. The picture itself STAYS,
         because a locked card you cannot see is a card nobody wants — the
         grid's job is to show what is worth chasing. Rarity keeps the colour
         it always had, on the border and the stamp. -->
    <i v-if="locked" class="cf-cover" aria-hidden="true"></i>
    <!-- size through the PROP, not a class. Icon writes width and height as
         an inline style, and an inline style beats any class the card can
         bring — the same way a tier size inline once rendered a 640x896
         illustration as a 116px square. Written as a container unit so the
         lock is a quarter of the card at every size the card is used at. -->
    <Icon v-if="locked" name="lock" class="cf-lock" size="26cqw" />
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
    <div class="cf-role">{{ sub || roleLabel
      }}<span class="cf-venue" :class="venueClass">{{ venueText }}</span></div>
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
import Icon from './Icon.vue'
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
  /* THE PICTURE FILLS THE CARD. Used to be derived — `size === 'lg' && !radar`
     — which was true of every card that wanted it at the time and of nothing
     else. It stopped being true the moment the collection grid wanted the
     same treatment at sm: the derivation would have dragged the goal cut-in
     and the upgrade mini card in with it, because they also pass radar=false
     and only ever wanted the initials. A card that bleeds says so. */
  full: Boolean,
  /* the laminated finish. Off in the grid on purpose: twenty cards shimmering
     at once is noise, and that screen's job is finding a card */
  foil: { type: Boolean, default: false },
  /* not in the collection yet — see the cover in the template */
  locked: Boolean,
  /* replaces the role line. The collection grid puts the shard count there on
     a locked card, which is the one number that says "keep pulling". A string
     rather than the count itself: shards are economy state, and the card face
     has no business importing the economy to render one line. */
  sub: { type: String, default: '' },
  selected: Boolean,
  dim: Boolean
})
/* EVERY card of a given size, not only the ones with a picture, and the gate
   is what settled that. Switching shape per card was the obvious first cut —
   one of twenty was illustrated, so give that one the 5:7 treatment and leave
   the rest alone — and `elements that move between states of one screen`
   reported 11 shifts across packopen-reveal immediately: the reveal showed F1
   at 266px and the next card at 185px, so the name, the verdict and the Next
   button all jumped 81px between two taps of the same button. A card's
   geometry may not depend on WHICH card it is; that is the same claim
   rarity-ladder makes about rarity.

   WHICH picture depends on the size, because the two pictures are different
   shapes and different crops of the same player. A 5:7 figure at 130px wide
   would put his head at about 18px — smaller than the 44px portrait it
   replaced, which is the opposite of the point. The head-and-shoulders
   portrait is square and gets scaled to the cell's height and cropped
   sideways, so it arrives bigger, not smaller. */
const artKind = computed(() => (props.size === 'lg' ? 'figure' : 'portrait'))
const initials = computed(() => props.card.name.slice(0, 2).toUpperCase())
const shirtNo = computed(() => (props.card.seed % 29) + 1)

const roleLabel = computed(() => ROLE_LABEL[props.card.role])
const roleCode = computed(() => ROLE_CODE[props.card.role] || '')
const venueMark = computed(() =>
  props.card.venue === 'home' ? 'H' : props.card.venue === 'away' ? 'A' : '')
/* The span stays in the markup even when `sub` has taken the line over, and
   goes empty instead. It is an anchor in three invariance groups — an empty
   one still measures 0x11, which is not a zero box — so making it a v-if
   would drop that anchor for locked cards only and shift every anchor after
   it against the owned card beside it. */
const venueClass = computed(() => (props.sub ? '' : props.card.venue))
const venueText = computed(() => (props.sub ? '' : venueMark.value))
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
  /* ONE SUBTITLE SIZE, named, because two things below are measured from it.
     max(), not a bare cqw: the brief's numbers were chosen against a 280-320px
     card and the collection grid is 130, where 5.4cqw is 7px — under anything
     else in the app and under the 9px this very line used when the grid was
     stacked rows. The floors ARE those old stacked sizes, so the grid loses no
     legibility by gaining a picture, and every lg card is untouched because
     5.4cqw at 280 is 15px and the floor never binds. */
  --cf-sub: max(9px, 5.4cqw);
  --cf-gap: max(4px, 3cqw);
  /* everything the bottom scrim has to cover: the role line, the gap, and the
     name's own line box. Named because the scrim is measured FROM it. */
  --cf-foot: calc(var(--cf-gap) + var(--cf-sub) * 1.2 + max(2px, 1.4cqw) + max(11px, 7.4cqw) * 1.1);
}
.cf-full .cf-art { position: absolute; inset: 0; margin: 0; display: block; }
.cf-full .cf-art .pa { width: 100%; height: 100%; }
/* THE TOP SCRIM, which is the badge's backdrop and the level's as well.

   Three chips sit up here and only one of them brought its own background:
   the rarity stamp, which is why it was never the problem. Giving the other
   two a chip each would have put three competing boxes in a 66px-wide row,
   so the backdrop goes behind the ROW. It is the same device the name has
   had at the other end of the card all along, which is also why it needs no
   new vocabulary to read.

   The gradient fades out below the type rather than ending on an edge, and
   the padding-bottom is what gives it somewhere to fade: the row is
   absolutely positioned, so a taller box costs no layout. */
.cf-full .cf-top {
  position: absolute; inset: 0 0 auto; z-index: 2;
  padding: 3.6cqw 4cqw 7cqw; font-size: max(9px, 5cqw);
  background: linear-gradient(to bottom,
    rgba(8,10,14,.80) 0%, rgba(8,10,14,.62) 42%, rgba(8,10,14,0) 100%);
}
.cf-full .cf-rar, .cf-full .cf-lv { font-size: max(9px, 5cqw); }
.cf-full .cf-rar { padding: 0.6cqw 1.8cqw; border-radius: 1.4cqw; }
/* A BACKDROP, NOT A COLOUR, and the stroke goes.
   (the backdrop is the top scrim below; this rule only drops the stroke)

   Measured on all twenty cards at both sizes a card is used at, differencing
   the rendered card against itself with the chrome hidden so the contrast is
   taken only on the pixels the type actually inks:

     the 1px divider stroke   69-100% of its own perimeter under 3:1
     the ST / PM text         up to 48% of the strokes under AA at 130px,
                              up to 77% at 66px, on 20 of 20

   The stroke is not half-visible, it is absent: #3A3F4A sits at the same
   luminance as the picture's mid-tones, so it matches its background almost
   everywhere rather than contrasting with it. The same four bands measured
   against white swing 3.09 to 20.34, which is what says the flatness belongs
   to the colour and not to the measurement.

   So the fix is a backdrop. Not a new colour: the product already spends
   three colour families on meaning (rarity, home/away, win/loss) and a fourth
   dilutes all three — the same argument that made this badge neutral grey in
   the first place. With something behind it the stroke has nothing left to
   do, and an invisible stroke that still paints is the smudge it was adding.

   TWO BACKDROPS, each with its own job, and measuring is what settled that.
   The row's scrim alone left G4 losing 26% of this badge's strokes at 130px:
   the gradient has faded to about .45 by the time it reaches the bottom of
   the glyphs, which is thinner than the .62 a chip of its own gives them. The
   chip alone left the LEVEL unprotected at the other end of the row. So the
   row carries the gradient and the badge carries a chip, which also puts it
   in the same vocabulary as the rarity stamp beside it.

   Scoped to .cf-full. The stacked cards (History, the pack summary, the
   shootout) put this badge on the card BODY, not on a picture, and the stroke
   reads fine against a flat dark surface. */
.cf-full .cf-pos {
  font-size: max(8px, 4.6cqw); padding: 0.4cqw 1.6cqw;
  border-color: transparent;
  background: rgba(8, 10, 14, .62);
}
/* THE CLEARANCE IS A RULE, NOT A NUMBER.

   This used to be a measured 10.8cqw, found by looking, with a comment saying
   8.4 put the name ON the role line. It survived exactly as long as the card
   had one size: the moment the grid asked for 130px the role line hit its 9px
   floor, stopped shrinking with the card, and 10.8cqw — 14px there — was
   inside it again. A number tuned at one size cannot hold at another.

   So the name sits at: the role's own offset, plus the role's own line box,
   plus a gap. Nothing here can drift out of step with the line below it
   because it is measured FROM the line below it. At 280 this lands on 30.5px
   against the old 30.2, which is the same card. */
.cf-full .cf-name {
  position: absolute; left: 0; right: 0; z-index: 2;
  bottom: calc(var(--cf-gap) + var(--cf-sub) * 1.2 + max(2px, 1.4cqw));
  font-size: max(11px, 7.4cqw); line-height: 1.1;
}
.cf-full .cf-role {
  position: absolute; left: 0; right: 0; bottom: var(--cf-gap); z-index: 2;
  font-size: var(--cf-sub); line-height: 1.2;
}
.cf-full .cf-venue.home, .cf-full .cf-venue.away { padding: 0 0.9cqw; }
/* Only as tall as the type it carries, and transparent for most of that: the
   bottom fifth is where the name lives and the picture's own safe area is. */
/* Tall enough for the type it carries, which is not the same as 32% of the
   card. At 280 and 130 those agree — the block is 53 and 29px against a 32%
   scrim of 125 and 58, so the name sits deep in the opaque end. At 66 they do
   not: the px floors stop the type shrinking with the card, so the same block
   is still 29px while 32% has fallen to 30, and the name's upper half ends up
   in the part of the gradient that has already faded to nothing. Measured,
   nine of twenty lost 1-42% of their strokes there.
   max(), so the two big sizes keep exactly the scrim they were tuned with and
   only the small card gets a taller one. */
.cf-scrim {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: max(32%, calc(var(--cf-foot) * 1.9));
  z-index: 1; pointer-events: none;
  background: linear-gradient(to top, rgba(8,10,14,.92) 0%, rgba(8,10,14,.72) 38%, rgba(8,10,14,0) 100%);
}
/* NOT OWNED. The dark layer is flat rather than a gradient, so it reads as
   something laid over the card rather than as part of the picture, and it is
   under the scrim and the type: the name and the shard count are the two
   things a locked card exists to say. */
.cf-cover {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  border-radius: inherit;
  background: rgba(8, 10, 14, .62);
}
/* 42%, not 50%: the lock wants the middle of what is LEFT once the name and
   the shard line have taken the bottom, otherwise it sits on the type. */
.cf-lock {
  position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%);
  z-index: 2; color: var(--rc, var(--text-2)); opacity: .82;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,.6));
}
.cf.locked { border-style: dashed; box-shadow: none; }
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
