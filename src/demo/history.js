import data from '../data/cards.json' with { type: 'json' }
import { buildTeam, priceMatch, drawResult, settle, powerOf, powerScore, settlementBranch } from '../engine/model.js'
import { buildScript } from '../engine/scriptgen.js'
import { rankWin, RANK_LOSS } from '../engine/economy.js'
const byId = Object.fromEntries(data.cards.map(c => [c.id, c]))
const slots = ['gk', 'df', 'mf', 'fw']
const snapshot = team => Object.fromEntries(slots.map(s => [s, { id: team.cards[s].id, level: team.cards[s].level }]))
const team = (ids, name) => buildTeam(Object.fromEntries(slots.map((s, i) => [s, { def: byId[ids[i]], level: 1 }])), name)
// Independent seeded randomness: constructing a new demo never affects live draws.
function rngFor (seed) { let n = seed >>> 0; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296 } }
export function createDemoHistory (now = Date.now()) {
  const you = team(['G1', 'F3', 'F2', 'F1'], 'You'), used = new Set()
  const specs = [
    ['LagosFalcons', true, 12, true], ['AbujaUnited', false, 47, false],
    ['KanoStrikers', true, 125, false], ['IbadanRoyals', false, 310, true],
    ['PortHarcourtFC', true, 1090, false]
  ]
  return specs.map(([name, won, minutes, aIsHome], i) => {
    const them = team(i % 2 ? ['G2', 'F6', 'F4', 'F5'] : ['G1', 'F3', 'F8', 'F1'], name)
    const priced = priceMatch(you, them), rng = rngFor(4703 + i * 97)
    for (let attempt = 0; attempt < 2000; attempt++) {
      const result = drawResult(priced, aIsHome, rng, i === 0 ? { forceDraw: true, minTieGoals: 1 } : {})
      const score = result.homeScore + ':' + result.awayScore
      if ((result.winner === 'A') !== won || used.has(score)) continue
      used.add(score)
      const script = buildScript(result, rng), stake = [10, 25, 50, 20, 35][i]
      const payment = settle(priced, result, stake, stake), br = settlementBranch(priced, aIsHome)
      return {
        id: 'demo-match-' + (i + 1), at: now - minutes * 60000, tierFee: stake >= 50 ? 50 : 10, stake,
        opponent: { handle: name, power: powerScore(powerOf(them)) },
        oddsIfHome: priced.branches.aHome.oddsA, oddsIfAway: priced.branches.bHome.oddsA, odds: br.oddsA,
        aIsHome, decks: { you: snapshot(you), them: snapshot(them) },
        homeScore: result.homeScore, awayScore: result.awayScore, wentToPk: result.wentToPk,
        pk: script.penalty ? { home: script.penalty.homeGoals, away: script.penalty.awayGoals } : null,
        won, payout: payment.payoutA, net: payment.payoutA - stake,
        rankDelta: won ? rankWin(br.qA) : RANK_LOSS, promotions: [], script
      }
    }
    throw new Error('Cannot construct demo history: ' + name)
  })
}
