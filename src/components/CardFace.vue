<template>
  <div class="cf" :class="[`r-${card.rarity}`, size, { sel: selected, dim: dim }]">
    <div class="cf-top">
      <span class="cf-rar">{{ card.rarity }}</span>
      <span class="cf-pos">{{ roleCode }}</span>
      <span class="cf-lv">Lv.{{ card.level }}</span>
    </div>
    <div class="cf-art">
      <RadarChart v-if="radar" :axis-keys="card.axisKeys" :values="card.axes" :size="artSize" />
      <div v-else class="cf-mono">{{ initials }}</div>
    </div>
    <div class="cf-name">{{ card.name }}</div>
    <!-- the venue span is ALWAYS rendered, empty for a neutral card. Measured:
         an empty one is 0x11, which is not a zero box, so it takes an anchor in
         the invariance groups — making it a v-if would drop that anchor for the
         six neutral cards only, and shift every later anchor index with it. -->
    <div class="cf-role">{{ roleLabel }}<span class="cf-venue" :class="card.venue">{{ venueMark }}</span></div>
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import RadarChart from './RadarChart.vue'
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
  selected: Boolean,
  dim: Boolean
})
/* sm is 44 rather than 54: the 3-column cell is 104px tall and 54 would make
   the card's own content 109, growing every row in the grid. */
const artSize = computed(() => ({ sm: 44, md: 74, lg: 116 }[props.size]))
const initials = computed(() => props.card.name.slice(0, 2).toUpperCase())
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
.cf-art { display: flex; flex: 1; align-items: center; justify-content: center; margin: 2px 0; }
/* only the lg detail card still shows initials; it reads as a rarity-coloured
   monogram rather than the grey repeat of the name directly under it */
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
/* The swatch is positioned OUT of the line box, with padding reserving its
   room. Measured the obvious way first — inline-flex with the swatch as a flex
   child — and it made the role line 0.6px taller on a home/away card than on a
   neutral one, which walked the four rows under it by 0.6px and failed the
   packopen-reveal invariance group. Absolute means the span's box is still
   pure text, identical to the empty neutral one. */
.cf-venue { position: relative; margin-left: 4px; font-weight: 800; }
.cf-venue.home, .cf-venue.away { padding-left: 9px; }
.cf-venue.home::before, .cf-venue.away::before {
  content: ''; position: absolute; left: 0; top: 50%; margin-top: -4px;
  width: 6px; height: 8px; border-radius: 1.5px;
}
.cf-venue.home { color: #FF8A93; }
.cf-venue.home::before { background: var(--home); }
.cf-venue.away { color: #8FC0FF; }
.cf-venue.away::before { background: var(--away); }
.sm .cf-name { font-size: 11px; }
.lg .cf-name { font-size: 16px; }
.lg .cf-role { font-size: 11px; }
.lg .cf-mono {
  font-size: 34px; font-weight: 900; letter-spacing: .04em;
  text-shadow: 0 2px 10px rgba(0,0,0,.45);
}
</style>
