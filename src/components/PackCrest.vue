<template>
  <svg class="pack-crest" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path class="hex" d="M22 12 17 20.66 7 20.66 2 12 7 3.34 17 3.34Z" />
    <!-- the ball is the tab bar's play icon, scaled by half. stroke-width
         scales with it, so 2.6 arrives as 1.3 and matches the hex -->
    <g transform="translate(12 12) scale(.5) translate(-12 -12)">
      <circle class="bl" cx="12" cy="12" r="8.5" />
      <path class="bl-f" d="M12 7.8 16 10.7 14.47 15.4 9.53 15.4 8 10.7Z" />
      <path class="bl" d="M12 7.8V3.5M16 10.7l4.08-1.33M14.47 15.4l2.52 3.48M9.53 15.4l-2.52 3.48M8 10.7L3.92 9.37" />
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
.bl-f { fill: var(--pack-ink, rgba(255,255,255,.34)); fill-opacity: .55; stroke: none; }
</style>
