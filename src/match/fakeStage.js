/* A stage made of plain objects, for testing the compiler without a browser.
   GSAP tweens plain objects happily, so the whole timeline can be built,
   jumped and inspected in node — which is where the "did the end state
   actually get applied" class of bug belongs. */

const el = () => ({ opacity: 1, scale: 1, left: '0%', top: '0%', x: 0, y: 0, rotate: 0, visibility: 'hidden', classList: { contains: () => false }, querySelector: () => el(), setAttribute () {}, style: {} })

export function createFakeStage (home, away) {
  const tokens = {}
  for (const side of ['home', 'away']) {
    for (const slot of ['gk', 'df', 'mf', 'fw']) tokens[side + ':' + slot] = el()
  }
  const parts = {
    ball: el(), pitch: el(), flash: el(), shock: el(), trail: el(),
    pkIntro: { root: el(), body: el(), progress: el() },
    cutin: { root: el(), bg: el(), body: el(), text: el(), streaks: el(), tint: el() },
    pk: {
      root: el(), bg: el(), vig: el(), head: el(), faceoff: el(), goal: el(),
      shooter: el(), keeper: el(), gk: el(), ripple: el(), ball: el(),
      stamp: el(), shooterName: el()
    },
    final: { root: el(), bg: el(), body: el(), score: el(), win: el() },
    scores: { home: el(), away: el() }
  }

  const state = {
    score: [0, 0], clock: '', phase: '', pkScore: null,
    cutIn: null, pk: null, pkStamp: '', final: null
  }

  return {
    state,
    parts,
    token: (side, slot) => tokens[side + ':' + slot],
    tokens: (side) => ['gk', 'df', 'mf', 'fw'].map(s => tokens[side + ':' + s]),
    allTokens: () => Object.values(tokens),
    ball: () => parts.ball,
    pitch: () => parts.pitch,
    flash: () => parts.flash,
    shock: () => parts.shock,
    trail: () => parts.trail,
    cutin: () => parts.cutin,
    pk: () => parts.pk,
    pkIntro: () => parts.pkIntro,
    final: () => parts.final,
    scoreEl: (side) => parts.scores[side],
    card: (side, slot) => (side === 'home' ? home : away).cards[slot],
    setScore: (h, a) => { state.score = [h, a] },
    setClock: (t) => { state.clock = t },
    setPhase: (t) => { state.phase = t },
    setPkScore: (h, a) => { state.pkScore = (h === null || h === undefined) ? null : h + ':' + a },
    setCutIn: (card, text, sub, side, team) => { state.cutIn = { card: card && card.name, text, sub, side, team } },
    setPk: (sh, kp, label, board, side) => { state.pk = { shooter: sh && sh.name, keeper: kp && kp.name, label, board, side } },
    setPkStamp: (t) => { state.pkStamp = t },
    setFinal: (side, text) => { state.final = { side, text } },
    reset: () => {}
  }
}
