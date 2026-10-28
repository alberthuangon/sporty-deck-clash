# tools/holo — what the finish actually does to a card

The layout gate reads the DOM. These read **pixels**, because the questions
the foil raises are not answerable from the DOM at all: whether a rainbow is
a rainbow, whether the gold body still reads as gold, whether the player is
still the same person under the light.

Everything here needs the layout harness served locally:

```bash
npx vite build --config tools/layout/vite.config.js
npx vite preview --config tools/layout/vite.config.js --port 8800
```

## The one rule these tools exist to obey

**Measure the difference, not the total.** Every script captures the same
frame twice — once with `.cf-foil` / `.cf-gloss` hidden — and reports the
difference. That is not fussiness: composite hue spread reads 0.3+ with the
finish switched entirely off, so it has no zero point, and a metric with no
zero point measures how colourful the card is rather than what the foil
contributed. Hiding the layers *defines* the zero.

## The scripts

| | what it answers |
|---|---|
| `ladder.mjs` | clones one card four times, swaps only the `r-*` class, pins the light, captures on/off. One player, one light, four rarities — so the only variable is rarity |
| `foildiff.py` | mean contribution, coverage, hue spread, per rarity |
| `kitshift.py` | where the kit's colour went. Selects pixels that ARE the kit colour in the off-frame, then reads those same pixels lit |
| `hair.py` | hair and skin separately, inside the head band |
| `envelope.mjs` | walks a 5x5 grid of `--holo-x` / `--holo-y` and captures all of it |
| `envscore.py` | worst case over that grid, scored against the venue-colour rule |
| `de00.py` | CIEDE2000 against `--home` and `--away` |

## Three ways these numbers have lied, all of them fixed here

**No zero point.** See above. Fixed by differencing.

**Right window, wrong aggregation.** Hue averaged over the head band read
45.7 degrees — inside the acceptable band — while the hair in that same frame
was plainly green. The face is four times the area. `hair.py` splits hair from
skin by brightness *in the unfoiled frame*, so the split comes from the
picture rather than from an assumption.

**One frame of a surface.** `--holo-x` / `--holo-y` are a pointer position; a
single capture measures one point. `envelope.mjs` walks the grid, and the
worst frame is a different one for each rarity.

## Known blind spots

- The kit selector matches one colour with a tolerance. A two-colour kit needs
  two passes, and it will silently find nothing if the colour is wrong — check
  the pixel count it prints before believing the row under it.
- The hair/skin split is brightness-only. A blond player and a pale background
  will confuse it.
- The forbidden arc for hair and skin is **90-210 degrees**, green through
  cyan. It is not derived from where warm colours live; it comes from which of
  four real cards were accepted and which were refused when they were looked
  at. Magenta hair and purple hair were accepted. Do not widen it to make
  something pass.
