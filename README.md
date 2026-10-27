# SportyKickDeck — Hackathon Demo (Phase 0)

Football card collection × real-player PvP betting simulation.
Pure front-end single-player demo: the model runs on the client, the opponent is
simulated and the pack pull is scripted — **but the maths is the production maths**
(PRD Part III).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/ (base './', zero external CDN, works offline)
npm run sim      # 10,000-match engine sanity check (RTP / draw rate / odds cap)
npm run layout   # every screen, every state, in headless Chrome
```

`npm run sim` runs in node against a fake stage, so it can see a thrown
animation callback but not a scoreboard row that appears at kick-off and
shoves the feed down 11px.

`npm run layout` covers that second kind. It needs Chrome (override the path
with `CHROME=...`), takes a couple of seconds, and makes two passes over one
build:

* the **match screen**, stepped frame by frame through a whole compiled match
* **every screen**, walked through 56 states — history empty and full, results
  won and lost with penalties and without, a pack mid-reveal and on its last
  card, upgrade short of shards and done, the match paused on the goal cut-in,
  the save cut-in, the shootout and the full-time card

Every state is reached the way a player reaches it: real game functions
(seeded, so it is reproducible) and real clicks on real buttons. The screens
keep their stage in local component state, and reaching in to set those refs
would test a reachability nobody has.

Fourteen assertions:

| | |
| --- | --- |
| stage height / feed position during a match | the scoreboard's pens row grew 11px at kick-off and pushed the feed down |
| stage clips its overlays | four overlays' entrances painted over the feed |
| on-screen things parked by compiling | gsap renders a `fromTo`'s start state immediately, so a beat that never plays still paints its "before" look. The scoreboard sat at 1.9× and bright green for whole matches |
| every state renders, and logs nothing | found a reactive write in a render pass that froze the tab, and two dead cut-in tweens |
| content cropped by its container | the cut-in's subtitle never fit on screen |
| elements past the 430px frame | |
| text cut off with nothing to show for it | an ellipsis is reported as a note, not a failure — it is truncation that says so |
| things painting over the TopBar / TabBar | |
| grid cells whose contents are ragged | a grid stretches its cells but not necessarily what is in them: owned cards sat 14px shorter than the locked placeholders beside them |
| controls under the 44px tap target | the floor Apple and Google both publish, measured on the PAINTED rect — a button padded out past the edge of its scroll container only counts the part you can reach. Native inputs are exempt: the browser gives a checkbox or a slider thumb a hit area bigger than its box |
| elements that move between states of one screen | the main one; see below |
| invariance groups comparing nothing | a check that compares nothing passes for free |

The last two are the point. States are put in a **group** when a player
sitting still on one screen can watch it turn into the other — mid-reveal in a
pack, a log streaming in, a coin landing, a mission being claimed. Inside a
group every shared element must sit at the same height, because those are the
transitions where something that grows shoves a button out from under a thumb.
Two outcomes rendered on two separate visits are allowed to differ, and are
only smoke- and geometry-checked. `scope` narrows a group to the region that
is promised to hold still.

Adding an assertion means first proving it goes red: break the thing
deliberately, watch it fail, put it back. Every one of the fourteen has been
through that, and two of them were *wrong* until it was done — one compared
nothing at all, another cropped a fixed-position box against a container that
does not crop it.

The last two were added after a pair of screenshots found what the gate could
not see yet, which is the honest order of events: the net gets bigger when
something swims through it.

Four things about headless Chrome that each produced a confident lie first:

* `requestAnimationFrame` fires **once** under `--virtual-time-budget` and
  never again. gsap's ticker runs on it, App.vue's screen transition is
  `:css="false"` + `onComplete -> done`, and `mode="out-in"` means the next
  screen is not mounted until the last one's leave tween finishes — so no
  screen after the first ever appeared. rAF is pointed at `setTimeout` from a
  classic inline script (classic because gsap grabs rAF at import time).
* `--window-size` is **ignored**; `innerWidth` reports 500×845 whatever you
  pass, and it moves when other flags change. The 430×932 frame is pinned
  from the page.
* `mode="out-in"` leaves the **outgoing** screen as the only `.screen` in the
  DOM, settled and opaque. Waiting for "a screen that looks ready" measured
  the previous one, and reported 20 identical copies of Home as a pass.
* a state that spins the main thread freezes virtual time too, so Chrome
  never exits and never dumps — no output, no timeout. Progress also goes to
  `console.log`, because Chrome's stderr survives being killed, and the runner
  turns "froze" into a named failure.

`window.__skd` on the real build (`store`, `go`, `game`) and `window.__match`
on the match screen are the same hatch by hand: `currentScreen` is
deliberately not persisted, so navigation cannot come from a saved state.

Designed for a 430px portrait phone frame; on desktop the frame is centred.

## Layout

```
src/
  engine/     pure functions, no DOM — can run under plain node
    cards.js      rarity budget + archetype weights + seed -> Lv.1-10 six axes -> model values
    model.js      team four-values -> lambda -> Poisson -> P(H/D/A) -> PK -> q -> odds -> draw
    scriptgen.js  result core -> regular-time event script + PK script
    economy.js    shard curve, packs, tiers, rank ladder
    sim.js        simulation harness
  match/player.js event script -> GSAP timeline (with Skip)
  screens/        one .vue per screen
  components/     CardFace / RadarChart / ...
  store.js        reactive global state + localStorage
  data/cards.json 20-card catalogue (stats derived, never hand-written)
```

## Branch pricing (PRD v0.21)

Home/away is drawn when the match is created and kept hidden; the coin toss
only reveals it. That is the same rule as the result itself — decided first,
performed afterwards — and it is what makes per-branch settlement honest:
by the time a player confirms, **both** branch prices are quoted and locked,
so the reveal is information nobody can act on.

```
Confirm     if you're HOME  1.61  win ₦80
            if you're AWAY  2.29  win ₦114      both locked
Toss        reveals AWAY — 2.29 lights up, 1.61 fades
Settle      floor(stake × 2.29)
```

The blended q survives for exactly two jobs, the matching condition and Power,
and settles nothing. Keeping the 2.50 cap on the blended figure is what stops
branch prices (which reach ~3.6) from shrinking the matching pool — an earlier
analysis of mine wrongly applied the cap to branch prices and concluded 64% of
pairings would break, which was a framing error, not a result.

Verified by `npm run sim`: each branch carries the margin **on its own**
(94.70% / 94.80% conditional EV against a 95% target), which an overall RTP
figure could otherwise hide if one branch subsidised the other. Platform
exposure on a single match widens from 0.5× stake to ~1.5× — still bounded,
and each pound of it is still +margin in expectation.

Rank scores against the realized branch, so winning from the away side pays
more (it was the less likely outcome). Drift stays at +5 per match.

## The margin is stated, not hidden

The confirm screen says "both prices carry the same 5% margin" out loud. The
overround is computable from any two-way book anyway, and this product's whole
position is that the maths is honest (PRD §13's compliance argument is exactly
"every player's expected cost equals the margin, whatever cards they hold") —
so leaving players to reverse-engineer it would have been a strange thing to be
coy about, next to published pack rates and a published jackpot draw.

One precision note for the pitch: 5% is the **pricing rule**. Displayed odds
are floored to two decimals (PRD §12.3, after the GH HALF_UP incident), and
flooring always favours the house, so a sharp player computing the book off the
displayed prices will find ~105.5%, i.e. a realised edge nearer 5.25%. Payouts
are floored to ₦1 on top of that. `npm run sim` reports both: 94.77% RTP at a
stake large enough to isolate the model, 94.49% at a realistic ₦50.

## Full time

The match ends on a card that states the whole result — score, shootout score,
and who won, washed in the winner's colour. Before it, a shootout result could
only be recovered by counting the feed.

The terminal state is defined once as data (`compiled.applyEnd`) and applied by
both the played-through path and Skip, rather than depending on which callbacks
a jumped playhead happens to fire.

## Non-negotiables (guide §11)

1. **Pricing and sampling share one distribution.** The odds and the drawn result
   come from the same probability object. PK is a **single sample**, never
   round-by-round. Payout is **floored**.
2. Animation never decides the outcome: draw the result, then write the script,
   then play it.
3. No real player names or likenesses — all card names are fictional (PRD appendix B).

## Golden path

```
Missions  claim the ₦200 bet mission      80 -> 110 diamonds
Shop      Standard Pack, 100 diamonds
PackOpen  2 duplicates -> shards, a new Rare, Okonkwo (Epic) last
Upgrade   Okonkwo Lv.1 -> Lv.2 with the ghost-outline preview
DeckEdit  swap Okonkwo into the forward slot, Power moves
Play      Start match -> ₦50 Home Arena (₦200 is Power-locked)
Matchmaking  the real two-stage search, with the numbers on screen
Confirm   IV-style odds cells + stake slider ₦50-199
Toss      home/away reveal, stakes lock here
Match     event script plays out, Skip available
Result    payout, rank, promotion, jackpot tickets
Rank      hex badge, reward road, ticket count
```

## Betting history and replay

Every settled match is recorded into `store.history` (newest first, capped at
20) with its deck snapshots, both branch quotes, the realized side, the money,
the rank move and **the whole script**.

Replay is free because of how the match was built in the first place: decide,
then perform. Replaying hands the stored script back to the same compiler, so
there is no recording and no state playback. Decks are rebuilt from the
snapshot, so levelling a card up afterwards does not retroactively change an
old match.

History is a bottom-nav tab of its own (🧾, between Missions and Rank), with a
three-row preview on Home for a glance. That gives the demo its "show me that
again" beat from anywhere, rather than only off the back of a result.

The replay path is isolated from settlement by construction — `finishMatch`
returns immediately when `ctx.replay` is set, the path never touches
`drawResult`, and the screen carries a REPLAY bar. Verified in the browser:
cash, diamonds, tickets, rank, match count and history length are all
byte-identical before and after a full replay.

## Motion lab

Demo settings → **Motion lab**. Replays a single attack wave in isolation and
exposes every beat length as a live slider, so the rhythm can be retuned
without a reload. The readout shows the projected whole-match length against
PRD §15.1's 45–60 second window.

### Match length

The whole match, shootout included, is capped at **30 seconds**. (This
overrides PRD §15.1's 45–60s — Albert's call; PRD v0.18 carries the change.)

The script generator budgets against that cap rather than guessing: the
shootout is compiled first, then `planWaveCount` picks the most wasted
attacks regular time can still afford. A goal costs twice a miss and a
shootout costs more again, so a 4–0 or a long shootout simply gets fewer
waves, and later goals get shorter celebrations (`cutInLength`).

Measured over 10,000 generated scripts: median **24.1s**, p95 27.7s, **98%
under 30s**. The ~2% that cannot fit (high-scoring draws into long shootouts)
get a global `timeScale` backstop from the compiler, so the cap always holds.

One subtlety the compiler has to handle: slow motion is applied at runtime via
`timeScale`, so it stretches wall-clock time without lengthening the timeline.
The cap is therefore checked against `rawDuration + goals × slowmoExtra`, not
`timeline.duration()`. Verified end to end in the browser — predicted 27.06s,
measured 26.48s.

Team colour does the identifying work in both cut-ins and the shootout: a goal
washes the screen in the scoring side's jersey colour, arriving from the
direction they attacked, before any name is legible. The keeper token and the
taker's name take their side's colour too — before this the keeper was
hardcoded blue, so in a shootout every kick looked like the same team taking
it.

### Penalties

Every kick is shown through the penalty camera everyone can already read:
goal frame and net, keeper inside it, ball on the spot, ball to one of six
placements, keeper to one of three dives. That picture is what gives the
script's `direction` / `height` / `dive` fields something to be measured
against — in an abstract layout a dive is just a card tilting.

The kick that settles the shootout gets a face-off hold first (PRD §16.4,
shooter card vs keeper card, vignette breathing at ~75bpm, keeper visibly
shifting his weight), then **cuts** to the same camera for the strike and the
reveal. Ordinary kicks skip the hold and go straight to the camera.

All of the tension sits *before* contact, which is what makes it honest — at
the moment the crowd holds its breath the picture itself does not yet know the
answer, so a goal and a save are pre-rolled identically and the performance
leaks nothing about the result. The reveal tells one of three stories from the
script's existing `direction`/`dive` fields: keeper goes the wrong way, keeper
goes the right way and it still goes in, or the save.

## Demo hatch

Tap the top-bar title 5× for demo settings:

| Switch | Default | What it does |
| --- | --- | --- |
| Force PK scenario | on | Conditions the draw on the tie diagonal of the same matrix, so the shootout always appears. The PK winner is still one sample. |
| Force a win | **off** | Presenter aid: redraws until the player wins so the promotion beat lands on stage. **This rigs the outcome** — payout and rank figures stop representing the model while it is on. |
| Fast match | off | 3× timeline, for rehearsals. |
| Reset demo state | — | Wipes localStorage, back to 80 ◆ / ₦5,000 / Bronze III 40-50. |

Neither override is used by `npm run sim`; the gate always samples truthfully.

> **On stage:** if the pitch says out loud that the result is decided entirely
> by the model, **Force a win must be off**. It is the one switch that makes
> that sentence untrue.
