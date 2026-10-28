# tools/layout — the part of "does it look broken" a machine can hold

`npm run layout`. Three passes over one build:

| pass | page | what it can see |
|---|---|---|
| the match | `index.html` | a whole compiled match, frame by frame, watching for mid-match shift |
| the sweep | `screens.html` | 81 states across every screen — boxes, not pixels |
| contrast  | `screens.html` | pixels, because one question needs them (`contrast.mjs`) |

Assertions live in `run.mjs`; `measure.js` only looks. Each check's own
reasoning sits beside it. This file holds the thing that is not attached to
any single check.

## Six ways a measurement here has lied, and what each one looked like

Every one of these produced a number that was arithmetically correct and
about the wrong thing. None was caught by reading code. They are collected
here because the sixth was predicted by none of the five, and the seventh
will be predicted by none of the six — what transfers is the *shape*, not the
list.

**1 · The wrong window.** A head-region crop was hardcoded, run twice, and
returned 1.4 both times. Reproducibility read as correctness. The window sat
in the gap between two rows: it was measuring background minus background.
→ *Find the window by differencing, never by reusing an offset.*

**2 · The wrong aggregation.** A head band averaged 45.7° of hue while the
hair in it was visibly green. The mean was real and the part that mattered
was a minority of the pixels in it.
→ *Split the region by something the data provides, before averaging.*

**3 · The sample too sparse to say anything.** Common's hue spread came back
at .528 — *higher than Rare* — computed from 2% of the card.
→ *Report the population the number came from, next to the number.*

**4 · A layer's metric describing the base.** Rare's achromatic foil reported
a hue spread of .556, exactly Epic's, because dodging by a neutral preserves
the hue underneath. The metric named the finish and measured the painting.
→ *Give every metric a zero point: run it with the subject absent and check
it reads nothing.*

**5 · The wrong object.** The card's chrome was checked by measuring the
LEVEL, which sits in a dark corner, and it came back at 12:1 — a clean bill
of health for a card whose role badge was losing up to 77% of its strokes.
The risk that got measured was the one that was guessed at.
→ *Enumerate the candidates and measure the worst, not the one that came to
mind.*

**6 · The wrong statistic, twice, in opposite directions.** For text over a
picture: the mean said a label was fine while a third of its strokes sat
under AA, and the worst pixel condemned a plainly legible card because a
glyph box is mostly not glyph. Same pixels, same code, three answers.
→ *When a check needs a statistic, the choice of statistic is the check.
Write down why that one, where the check is.*

## Two questions, not one

The first five above all announce themselves eventually: a broken metric
disagrees with reality, and reality argues back. The ones that cost the most
were the agreeable kind — a number that is *adjacent* to the truth correlates
with it and never argues. So:

- **What could this number be lying about?**
- **Why is this number so agreeable?**

The second one found #4 and #5. Nothing else did.

## And the cheapest instruments

Most of the above were found by one of three moves, all of them cheaper than
the reasoning that would have predicted them:

- **Move one variable alone.** Triple the yaw and watch whether the budget
  that claims to bound it answers. It did not — vertical spread is a *pitch*
  quantity, and a budget that does not respond to the axis it is named after
  is not that axis's budget.
- **Make the assertion fail.** Not for *some* break — for the specific thing
  it is named after. An assertion whose evidence comes from a sample it takes
  itself cannot catch the lie it was written for: `holo cards measured
  standing still` read the lean from its own probe rather than from the pin
  the sweep was left on, and pinning the whole sweep flat left all 39 checks
  green.
- **Let the whole harness judge.** "Does this fit?" was answered by measuring
  free space in one state per screen, and was wrong on two of five. Applying
  the change and running all 81 states is cheaper than the estimate and tests
  states nobody would have named. The worst case is rarely the one on screen:
  it is the state with the extra banner, the longest name, the card nobody
  owns.

## A note on sampling

Two checks here read a *list* rather than the sweep, and the reason is the
same both times. `cards with no picture on disk` reads the directory, because
deleting a goalkeeper's portrait changed nothing — 81 states and not one of
them shows G2. `contrast.mjs` clones all twenty cards and forces them
unlocked, because a locked card's dark cover makes every label easier and
whichever cards a state happens to own are the easy half of the exam.

**The sweep is a sample of states. A catalogue is a fixed list. A list is
checked against a list.**
