/* Economy tables — PRD §6.2, §6.3, §6.4, §6.5. Pure data + pure functions. */

/* §6.3 shard cost to reach level N+1 from level N. Index = source level. */
export const SHARD_COST = {
  C: { 1: 2, 2: 4, 3: 8, 4: 15, 5: 25, 6: 40, 7: 70, 8: 120, 9: 200 },
  R: { 1: 2, 2: 3, 3: 6, 4: 10, 5: 15, 6: 25, 7: 40, 8: 60, 9: 100 },
  E: { 1: 1, 2: 2, 3: 4, 4: 6, 5: 10, 6: 15, 7: 20, 8: 30, 9: 50 },
  L: { 1: 1, 2: 1, 3: 2, 4: 3, 5: 4, 6: 6, 7: 8, 8: 10, 9: 15 }
}

export const MAX_LEVEL = 10

export function shardCost (rarity, level) {
  if (level >= MAX_LEVEL) return null
  return SHARD_COST[rarity][level]
}

/* §6.2 pack types.

   A pack is (cards - 1) normal slots plus one slot restricted to the pack's
   guaranteed floor, which is how the "at least 1 Rare / Epic" promise is kept
   without distorting anything after the fact. `odds` is the PUBLISHED per-card
   table and is derived from that structure, so what the rate screen shows is
   exactly what the sampler produces — verified in packRates() below. */
export const PACKS = [
  {
    id: 'standard',
    name: 'Standard Pack',
    price: 100,
    cards: 5,
    guarantee: 'At least 1 Rare',
    slotOdds: [
      { rarity: 'C', pct: 87.5 },
      { rarity: 'R', pct: 10 },
      { rarity: 'E', pct: 2.0833333 },
      { rarity: 'L', pct: 0.4166667 }
    ],
    guaranteedFrom: ['R', 'E', 'L'],
    // marginal per-card rates implied by the above -- PRD §6.2's table exactly
    odds: [
      { rarity: 'C', label: 'Common', pct: 70 },
      { rarity: 'R', label: 'Rare', pct: 24 },
      { rarity: 'E', label: 'Epic', pct: 5 },
      { rarity: 'L', label: 'Legendary', pct: 1 }
    ]
  },
  {
    id: 'gold',
    name: 'Gold Pack',
    price: 450,
    cards: 5,
    guarantee: 'At least 1 Epic · double Legendary rate',
    slotOdds: [
      { rarity: 'C', pct: 62.5 },
      { rarity: 'R', pct: 25 },
      { rarity: 'E', pct: 11.6666667 },
      { rarity: 'L', pct: 0.8333333 }
    ],
    guaranteedFrom: ['E', 'L'],
    odds: [
      { rarity: 'C', label: 'Common', pct: 50 },
      { rarity: 'R', label: 'Rare', pct: 20 },
      { rarity: 'E', label: 'Epic', pct: 28 },
      { rarity: 'L', label: 'Legendary', pct: 2 }
    ]
  }
]

export const RARITY_ORDER = { C: 0, R: 1, E: 2, L: 3 }

function drawRarity (odds, rng) {
  const total = odds.reduce((t, o) => t + o.pct, 0)
  let r = rng() * total
  for (const o of odds) { r -= o.pct; if (r <= 0) return o.rarity }
  return odds[odds.length - 1].rarity
}

/* Draw one pack. Pure: catalogue is passed in and randomness is injectable,
   so the sampler is testable under plain node (see packRates). */
export function rollPack (pack, catalogue, rng = Math.random) {
  const ofRarity = (rarity) => {
    const pool = catalogue.filter(c => c.rarity === rarity)
    return pool[Math.floor(rng() * pool.length)]
  }

  const picks = []
  for (let i = 0; i < pack.cards - 1; i++) {
    picks.push(ofRarity(drawRarity(pack.slotOdds, rng)))
  }
  const guaranteed = pack.slotOdds.filter(o => pack.guaranteedFrom.includes(o.rarity))
  picks.push(ofRarity(drawRarity(guaranteed, rng)))

  // highest rarity always revealed last (PRD §6.2 "神抽時刻")
  picks.sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity])
  return picks
}

/* Exact marginal per-card rates implied by a pack's slot structure.
   The published `odds` table must equal this — asserted by npm run sim. */
export function packRates (pack) {
  const n = pack.cards
  const slotTotal = pack.slotOdds.reduce((t, o) => t + o.pct, 0)
  const gSlots = pack.slotOdds.filter(o => pack.guaranteedFrom.includes(o.rarity))
  const gTotal = gSlots.reduce((t, o) => t + o.pct, 0)
  const out = {}
  pack.slotOdds.forEach(o => {
    const normal = (n - 1) * (o.pct / slotTotal)
    const guaranteed = pack.guaranteedFrom.includes(o.rarity) ? o.pct / gTotal : 0
    out[o.rarity] = ((normal + guaranteed) / n) * 100
  })
  return out
}

/* §6.5 entry fee tiers. unlockPower = required collection power (q_ref scale). */
export const TIERS = [
  { id: 't10', fee: 10, name: 'Practice Arena', unlockPower: 0 },
  { id: 't50', fee: 50, name: 'Home Arena', unlockPower: 0.42 },
  { id: 't200', fee: 200, name: 'Pro Arena', unlockPower: 0.60 }
]

export function nextTierFee (fee) {
  const i = TIERS.findIndex(t => t.fee === fee)
  return i >= 0 && i + 1 < TIERS.length ? TIERS[i + 1].fee : fee * 4
}

/* stake range on the confirm screen: [tier floor, next tier floor - 1] */
export function stakeRange (fee) {
  return { min: fee, max: nextTierFee(fee) - 1 }
}

/* §6.4.2 rank ladder */
export const RANK_TIERS = [
  { name: 'Bronze', step: 50, colour: '#C07A3C' },
  { name: 'Silver', step: 75, colour: '#AFB6C2' },
  { name: 'Gold', step: 100, colour: '#E0AC2B' },
  { name: 'Platinum', step: 125, colour: '#58D6C9' },
  { name: 'Diamond', step: 150, colour: '#6AA6FF' },
  { name: 'Champion', step: null, colour: '#F0564A' }
]

export const SUBTIER_LABEL = { 3: 'III', 2: 'II', 1: 'I' }

/* §6.4.3 reward road — one node per subtier promotion, diamonds / tickets alternating. */
export const REWARD_ROAD = [
  { id: 'b3', label: 'Bronze II', reward: { tickets: 2 } },
  { id: 'b2', label: 'Bronze I', reward: { diamonds: 50 } },
  { id: 'b1', label: 'Silver III', reward: { tickets: 3 }, big: true },
  { id: 's3', label: 'Silver II', reward: { diamonds: 60 } },
  { id: 's2', label: 'Silver I', reward: { tickets: 3 } },
  { id: 's1', label: 'Gold III', reward: { diamonds: 100, tickets: 10 }, big: true },
  { id: 'g3', label: 'Gold II', reward: { tickets: 4 } },
  { id: 'g2', label: 'Gold I', reward: { diamonds: 80 } }
]

/* §6.4.1 expectation-levelling score. q = own pricing win probability. */
export const RANK_DRIFT = 5
export function rankWin (q) { return Math.floor((RANK_DRIFT + (1 - q) * 20) / q) }
export const RANK_LOSS = -20

/* Advance the rank ladder. Subtiers can drop; major tiers cannot (tier floor). */
export function applyRankDelta (rank, delta) {
  let { score, tierIndex, subtier } = rank
  const promotions = []
  score += delta
  for (;;) {
    const tier = RANK_TIERS[tierIndex]
    if (tier.step === null) break                      // Champion: open ladder
    if (score >= tier.step) {
      score -= tier.step
      if (subtier > 1) { subtier -= 1 } else { tierIndex += 1; subtier = 3 }
      promotions.push({ tierIndex, subtier })
      continue
    }
    if (score < 0) {
      if (subtier < 3) { subtier += 1; score += tier.step }
      else { score = 0 }                                // major tier floor
      continue
    }
    break
  }
  return { rank: { ...rank, score, tierIndex, subtier }, promotions }
}

export function rankLabel (tierIndex, subtier) {
  const t = RANK_TIERS[tierIndex]
  return t.step === null ? t.name : `${t.name} ${SUBTIER_LABEL[subtier]}`
}

/* total ladder position, used to index the reward road */
export function ladderIndex (tierIndex, subtier) {
  return tierIndex * 3 + (3 - subtier)
}
