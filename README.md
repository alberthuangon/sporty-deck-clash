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
```

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
