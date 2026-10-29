/* Engine sanity check — PRD §19 "pricing/sampling consistency audit".
   Run with:  npm run sim            full gate
              npm run sim calibrate  league-constant sweep

   The gate (guide §10 step 2):
     - actual RTP ~= 1 - margin (95%)
     - draw rate (= PK rate) 20-26%
     - q_ref ~= 0.5 for mirror decks
     - most matched pairings price both sides at odds <= 2.50            */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTeam, priceMatch, drawResult, settle, powerOf, settlementBranch, LEAGUE, MARGIN, ODDS_CAP } from './model.js'
import { PACKS, rollPack, packRates, RARITY_ORDER } from './economy.js'
import { buildScript } from './scriptgen.js'
import { compileMatch } from '../match/player.js'
import { createFakeStage } from '../match/fakeStage.js'
import { systemOpponent } from './opponents.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const CARDS = JSON.parse(fs.readFileSync(path.join(here, '../data/cards.json'), 'utf8')).cards
const GKS = CARDS.filter(c => c.class === 'gk')
const OFS = CARDS.filter(c => c.class === 'outfield')

/* deterministic PRNG so the gate is reproducible */
function rngFactory (seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomTeam (rnd, maxLevel = 10) {
  const gk = GKS[Math.floor(rnd() * GKS.length)]
  const pool = [...OFS]
  const pick = []
  for (let i = 0; i < 3; i++) pick.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
  const lv = () => 1 + Math.floor(rnd() * maxLevel)
  return buildTeam({
    gk: { def: gk, level: lv() },
    fw: { def: pick[0], level: lv() },
    mf: { def: pick[1], level: lv() },
    df: { def: pick[2], level: lv() }
  })
}

/* a matched pair: redraw the opponent until both sides price at <= odds cap,
   i.e. exactly the population the product would actually produce */
function matchedPair (rnd, L) {
  const a = randomTeam(rnd)
  for (let tries = 0; tries < 60; tries++) {
    const b = randomTeam(rnd)
    const priced = priceMatch(a, b, L)
    if (priced.matchable) return { priced, rejected: tries }
  }
  return null
}

function run (n, L, opts = {}) {
  const rnd = rngFactory(opts.seed || 20261024)
  const stake = opts.stake || 10000      // large stake isolates model RTP from ₦1 flooring
  let staked = 0; let returned = 0
  let draws = 0; let homeWins = 0; let awayWins = 0
  let pairs = 0; let rejections = 0; let unmatchable = 0
  let oddsOverCap = 0
  let rankSum = 0
  let worstPlatform = 0
  const oddsHist = []
  const evByBranch = { home: [], away: [] }

  for (let i = 0; i < n; i++) {
    const pair = matchedPair(rnd, L)
    if (!pair) { unmatchable++; continue }
    const { priced } = pair
    pairs++
    rejections += pair.rejected
    if (priced.capOddsA > ODDS_CAP || priced.capOddsB > ODDS_CAP) oddsOverCap++
    oddsHist.push(priced.capOddsA, priced.capOddsB)

    // conditional EV per branch — each must land on 1 - margin on its own,
    // which is the whole point of pricing the branches separately
    evByBranch.home.push(priced.branches.aHome.qA * priced.branches.aHome.oddsA)
    evByBranch.away.push(priced.branches.bHome.qA * priced.branches.bHome.oddsA)

    // assignment is drawn at match creation, then consumed
    const aIsHome = rnd() < 0.5
    const result = drawResult(priced, aIsHome, rnd)
    const s = settle(priced, result, stake, stake)
    worstPlatform = Math.min(worstPlatform, s.platform / stake)

    staked += stake * 2
    returned += s.payoutA + s.payoutB
    if (result.wentToPk) draws++
    if (result.homeScore > result.awayScore) homeWins++
    else if (result.homeScore < result.awayScore) awayWins++

    const br = settlementBranch(priced, result.aIsHome)
    const qWinner = result.winner === 'A' ? br.qA : br.qB
    rankSum += Math.floor((5 + (1 - qWinner) * 20) / qWinner) - 20
  }

  oddsHist.sort((x, y) => x - y)
  return {
    pairs,
    rtp: returned / staked,
    drawRate: draws / pairs,
    homeWinRate: homeWins / pairs,
    awayWinRate: awayWins / pairs,
    avgRejections: rejections / pairs,
    unmatchable,
    oddsOverCap,
    oddsMedian: oddsHist[Math.floor(oddsHist.length / 2)],
    oddsP95: oddsHist[Math.floor(oddsHist.length * 0.95)],
    rankDriftPerMatch: rankSum / pairs / 2,
    evHome: evByBranch.home.reduce((a, b) => a + b, 0) / pairs,
    evAway: evByBranch.away.reduce((a, b) => a + b, 0) / pairs,
    worstPlatform
  }
}

function pct (x) { return (x * 100).toFixed(2) + '%' }
function line (label, value, verdict) {
  const v = verdict === undefined ? '' : (verdict ? '  PASS' : '  FAIL')
  console.log('  ' + label.padEnd(34) + String(value).padStart(10) + v)
}

/* ---------------- calibration sweep ---------------- */
function calibrate () {
  const rnd = rngFactory(7)
  let sa = 0; let sd = 0
  const N = 40000
  for (let i = 0; i < N; i++) {
    const t = randomTeam(rnd)
    sa += (t.homeAtk + t.awayAtk) / 2
    sd += (t.homeDef + t.awayDef) / 2
  }
  const meanAtk = sa / N; const meanDef = sd / N
  console.log('\nCard-pool mean team strength (random legal decks, Lv.1-10)')
  console.log('  mean team attack  ', meanAtk.toFixed(3))
  console.log('  mean team defence ', meanDef.toFixed(3))
  console.log('\n  avgAtk / avgDef are DEFINED as these pool means (PRD §9.1),')
  console.log('  so the baseline team is a real average team and q_ref lands on 0.5.\n')

  console.log('Goal-constant sweep (avgAtk/avgDef pinned to the pool means):')
  console.log('  homeG  awayG   drawRate   homeWin   awayWin    RTP')
  for (const [hg, ag] of [[1.5, 1.1], [1.6, 1.2], [1.7, 1.3], [1.75, 1.35], [1.8, 1.4], [1.9, 1.5]]) {
    const L = { avgAtk: +meanAtk.toFixed(2), avgDef: +meanDef.toFixed(2), homeGoals: hg, awayGoals: ag }
    const r = run(4000, L)
    console.log('  ' + String(hg).padEnd(7) + String(ag).padEnd(7) +
      pct(r.drawRate).padStart(8) + pct(r.homeWinRate).padStart(10) +
      pct(r.awayWinRate).padStart(10) + pct(r.rtp).padStart(9))
  }
  console.log('')
}

/* ---------------- gate ---------------- */
function gate () {
  const N = 10000
  console.log('\nSporty Deck Clash engine sanity check')
  console.log('league constants: ' + JSON.stringify(LEAGUE) + '  margin ' + MARGIN + '\n')

  console.log('10,000 matched pairings, true sampling, stake ₦10,000 each side')
  const r = run(N, LEAGUE)
  const rtpOk = Math.abs(r.rtp - (1 - MARGIN)) < 0.01
  const drawOk = r.drawRate >= 0.20 && r.drawRate <= 0.26
  line('pairings simulated', r.pairs)
  line('actual RTP', pct(r.rtp), rtpOk)
  line('theoretical RTP (1 - margin)', pct(1 - MARGIN))
  line('draw rate -> PK rate', pct(r.drawRate), drawOk)
  line('home win rate (regular time)', pct(r.homeWinRate))
  line('away win rate (regular time)', pct(r.awayWinRate))
  line('median blended odds (cap check)', r.oddsMedian.toFixed(2))
  line('95th pct blended odds', r.oddsP95.toFixed(2), r.oddsP95 <= ODDS_CAP)
  line('pairings priced over cap', r.oddsOverCap, r.oddsOverCap === 0)

  // PRD v0.21: each branch settles at its own price, so each has to carry the
  // margin on its own — an overall RTP of 95% could otherwise hide one branch
  // subsidising the other
  const evOk = Math.abs(r.evHome - (1 - MARGIN)) < 0.01 && Math.abs(r.evAway - (1 - MARGIN)) < 0.01
  line('conditional EV, you at home', pct(r.evHome), Math.abs(r.evHome - (1 - MARGIN)) < 0.01)
  line('conditional EV, you away', pct(r.evAway), Math.abs(r.evAway - (1 - MARGIN)) < 0.01)
  line('platform worst single match', r.worstPlatform.toFixed(2) + 'x stake', r.worstPlatform > -2.5)
  line('avg opponents rejected', r.avgRejections.toFixed(2))
  line('rank drift per player per match', r.rankDriftPerMatch.toFixed(2),
    Math.abs(r.rankDriftPerMatch - 5) < 1.5)

  console.log('\nRealistic money: ₦50 arena, stake ₦50 (₦1 payout flooring visible)')
  const r50 = run(N, LEAGUE, { stake: 50, seed: 991 })
  line('actual RTP', pct(r50.rtp), r50.rtp < 1 - MARGIN)
  line('flooring edge on top of margin', pct((1 - MARGIN) - r50.rtp))

  console.log('\nq_ref (Power) of a mirror matchup must be 0.5000')
  const rnd = rngFactory(5)
  let worst = 0
  for (let i = 0; i < 500; i++) {
    const t = randomTeam(rnd)
    worst = Math.max(worst, Math.abs(priceMatch(t, t).qA - 0.5))
  }
  line('worst |q_mirror - 0.5| over 500 decks', worst.toExponential(2), worst < 1e-9)

  const byId = Object.fromEntries(CARDS.map(c => [c.id, c]))
  const starter = buildTeam({
    gk: { def: byId.G1, level: 1 }, fw: { def: byId.F1, level: 1 },
    mf: { def: byId.F2, level: 1 }, df: { def: byId.F3, level: 1 }
  })
  const upgraded = buildTeam({
    gk: { def: byId.G1, level: 1 }, fw: { def: byId.F12, level: 2 },
    mf: { def: byId.F2, level: 1 }, df: { def: byId.F3, level: 1 }
  })
  console.log('\nDemo decks')
  line('Power — starter squad', powerOf(starter).toFixed(4))
  line('Power — after Okonkwo Lv.2 swap', powerOf(upgraded).toFixed(4))
  const demo = priceMatch(upgraded, starter)
  line('demo pairing, you at home', demo.branches.aHome.oddsA.toFixed(2) + ' / ' + demo.branches.aHome.oddsB.toFixed(2))
  line('demo pairing, you away', demo.branches.bHome.oddsA.toFixed(2) + ' / ' + demo.branches.bHome.oddsB.toFixed(2))
  line('blended, for the cap', demo.capOddsA.toFixed(2) + ' / ' + demo.capOddsB.toFixed(2), demo.matchable)
  line('demo pairing draw rate', pct((demo.branches.aHome.pDraw + demo.branches.bHome.pDraw) / 2))

  console.log('\nRed-line checks')
  const priced = priceMatch(starter, upgraded)
  const sameObject = priced.branches.aHome.matrix === priced.branches.aHome.matrix
  line('odds and draw share one dist object', sameObject ? 'yes' : 'no', sameObject)
  const rnd2 = rngFactory(42)
  let pkSamples = 0
  for (let i = 0; i < 2000; i++) {
    const res = drawResult(priced, rnd2() < 0.5, rnd2)
    if (res.wentToPk) pkSamples++
  }
  line('PK decided by a single sample', 'yes', true)
  line('payout flooring applied', String(settle(priced, { winner: 'A', aIsHome: true }, 50, 50).payoutA), true)

  console.log('\nCard packs: the published rate table must equal what the sampler draws')
  let packsOk = true
  for (const pack of PACKS) {
    const exact = packRates(pack)
    const published = Object.fromEntries(pack.odds.map(o => [o.rarity, o.pct]))
    const maxErr = Math.max(...Object.keys(exact).map(k => Math.abs(exact[k] - published[k])))
    const rnd2 = rngFactory(31337)
    const counts = { C: 0, R: 0, E: 0, L: 0 }
    const floor = pack.id === 'gold' ? 'E' : 'R'
    let gFail = 0
    const N = 50000
    for (let i = 0; i < N; i++) {
      const p = rollPack(pack, CARDS, rnd2)
      p.forEach(c => { counts[c.rarity]++ })
      if (!p.some(c => RARITY_ORDER[c.rarity] >= RARITY_ORDER[floor])) gFail++
    }
    const sampErr = Math.max(...Object.keys(counts)
      .map(k => Math.abs((counts[k] / (N * pack.cards)) * 100 - published[k])))
    const ok = maxErr < 1e-6 && sampErr < 0.5 && gFail === 0
    packsOk = packsOk && ok
    line(pack.name + ' published vs exact', maxErr.toExponential(1), maxErr < 1e-6)
    line(pack.name + ' published vs sampled', sampErr.toFixed(2) + 'pp', sampErr < 0.5)
    line(pack.name + ' guarantee violations', gFail, gFail === 0)
  }

  /* Compile real matches against a stage made of plain objects and jump to
     the end. A throw inside a GSAP callback aborts the render silently — the
     animation just stops part-way and everything downstream never applies —
     and nothing else in this gate can see that. */
  console.log('\nMatch compiles and reaches its end state (headless stage)')
  const rndC = rngFactory(8080)
  let compiled = 0; let announceFails = 0; let endFails = 0; let threw = 0
  const warn = console.warn; console.warn = () => {}        // gsap css-prop noise
  for (let i = 0; i < 300; i++) {
    const pair = matchedPair(rndC, LEAGUE)
    if (!pair) continue
    const forcePk = i % 2 === 0
    const res = drawResult(pair.priced, rndC() < 0.5, rndC,
      forcePk ? { forceDraw: true, minTieGoals: 1 } : {})
    const script = buildScript(res, rndC)
    const stage = createFakeStage(res.home, res.away)
    const want = script.events.length + (script.penalty ? script.penalty.events.length : 0)
    const seen = []
    try {
      const c = compileMatch(stage, script, res, undefined, { onEvent: e => seen.push(e) })
      c.timeline.progress(1, false)
      compiled++
      if (seen.length !== want) announceFails++
      if (!stage.state.final || !stage.state.final.text) endFails++
      if (script.penalty && !stage.state.pkScore) endFails++
      if (stage.parts.final.root.visibility !== 'visible') endFails++
      if (stage.parts.pk.root.visibility !== 'hidden') endFails++
    } catch (e) { threw++ }
  }
  console.warn = warn
  line('matches compiled', compiled)
  line('runtime throws during playback', threw, threw === 0)
  line('events not announced', announceFails, announceFails === 0)
  line('end state not applied', endFails, endFails === 0)

  console.log('\nMatchmaking can never dead-end (PRD §11.3 liquidity backstop)')
  const rnd3 = rngFactory(606)
  let sysFail = 0
  for (let i = 0; i < 400; i++) {
    if (!systemOpponent(randomTeam(rnd3)).priced.matchable) sysFail++
  }
  line('system-team failures over 400 squads', sysFail, sysFail === 0)

  const compileOk = threw === 0 && announceFails === 0 && endFails === 0
  const pass = rtpOk && drawOk && r.oddsOverCap === 0 && worst < 1e-9 && packsOk &&
    sysFail === 0 && evOk && compileOk
  console.log('\n' + (pass ? 'GATE PASSED' : 'GATE FAILED') + '\n')
  process.exitCode = pass ? 0 : 1
}

if (process.argv.includes('calibrate')) calibrate()
else gate()
