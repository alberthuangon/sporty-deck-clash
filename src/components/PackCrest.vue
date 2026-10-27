<template>
  <svg class="pack-crest" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path class="hex" d="M22 12 17 20.66 7 20.66 2 12 7 3.34 17 3.34Z" />
    <!-- The ball, WITHOUT the tab bar's seams. Those five lines run from the
         pentagon out to the rim, which at 19px the eye completes into a ball
         and at 31px reads as spokes — a simplification drawn for one size
         becomes an error at another. Circle plus a solid pentagon is the
         oldest shorthand there is and has no spokes to misread. -->
    <g transform="translate(12 12) scale(.5) translate(-12 -12)">
      <circle class="bl" cx="12" cy="12" r="8.5" />
      <path class="bl-f" d="M12 7.8 16 10.7 14.47 15.4 9.53 15.4 8 10.7Z" />
    </g>
  </svg>
</template>

<script setup>
/* The mark on a card pack: the rank screen's hexagon with the tab bar's
   football inside it. Nothing here is a new shape — both halves are already
   on screen elsewhere, which is the point. Takes its colour from --pack-ink,
   so the tier that owns the pack owns the crest too. */
</script>

<style scoped>
.pack-crest { display: block; width: 100%; height: 100%; }
.hex { fill: none; stroke: var(--pack-ink, rgba(255,255,255,.34)); stroke-width: 1.3; }
.bl { fill: none; stroke: var(--pack-ink, rgba(255,255,255,.34)); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.bl-f { fill: var(--pack-ink, rgba(255,255,255,.34)); stroke: none; }
</style>
