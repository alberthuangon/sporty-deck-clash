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

/* §6.2 pack types */
export const PACKS = [
  {
    id: 'standard',
    name: 'Standard Pack',
    price: 100,
    cards: 5,
    guarantee: 'At least 1 Rare',
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
    odds: [
      { rarity: 'C', label: 'Common', pct: 55 },
      { rarity: 'R', label: 'Rare', pct: 32 },
      { rarity: 'E', label: 'Epic', pct: 11 },
      { rarity: 'L', label: 'Legendary', pct: 2 }
    ]
  }
]

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
