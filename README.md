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

## Non-negotiables (guide §11)

1. **Pricing and sampling share one distribution.** The odds and the drawn result
   come from the same probability object. PK is a **single sample**, never
   round-by-round. Payout is **floored**.
2. Animation never decides the outcome: draw the result, then write the script,
   then play it.
3. No real player names or likenesses — all card names are fictional (PRD appendix B).

## Demo hatch

Tap the top-bar title 5× for demo settings (force-PK switch, state reset).
