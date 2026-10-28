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

**The layer's number describing the base.** Hue spread over the difference is
only about the finish while the finish has a hue. Dodge by a neutral keeps the
base's hue, so Rare's achromatic foil reports a spread of .556 — identical to
Epic's two-colour one — and every bit of that is the painting underneath.
Don't read the hue column for an achromatic step; read the count the ladder
claims instead.

That one was caught by a coincidence, and the coincidence is the lesson. It
read **exactly** Epic's figure — had the painting under it been slightly
duller and returned .49, it would have been a tidy "Rare a little below Epic",
exactly what anyone would expect, and nobody would have looked. Every other
entry on this list was caught by a number that looked WRONG. This one was
caught by a number that looked too right.

So there is a second question to ask of a measurement, beside "what does this
metric lie about": **why is this number so agreeable?**

## Known blind spots

- The kit selector matches one colour with a tolerance. A two-colour kit needs
  two passes, and it will silently find nothing if the colour is wrong — check
  the pixel count it prints before believing the row under it.
- The hair/skin split is brightness-only. A blond player and a pale background
  will confuse it.
- The forbidden arc for hair and skin is **90-210 degrees**, green through
  cyan. It is not derived from where warm colours live; it comes from which of
  four real cards were accepted and which were refused when they were looked
  at. Magenta hair and purple hair were accepted.

## About the thresholds in here

Do not widen one to make something pass — and **do not tighten one to make
something fail**. Both directions are the same mistake. The 20% allowance on
cold hair pixels was set before anyone knew that the two candidate fixes would
come in at 13.8% and 0.1%; tightening it afterwards to prefer the cleaner one
would have been calibrating the threshold to the result it was supposed to
judge. A threshold means something only if it was set beforehand and then
honoured — and *afterwards* runs in both directions.

## About margins

These tools report margins. Comments should not. A comment that states a
margin makes a claim about two things at once — the measurement and the
threshold — and either can move without anyone touching that file. The
`.r-L` comment in `src/styles/tokens.css` went stale twice this way: first
quoting a dE-76 threshold of 20 that had been replaced elsewhere, then
quoting the replacement against a worst case nobody had measured yet. Record
the rule and where it is enforced; leave the margin to whoever runs the
check.
