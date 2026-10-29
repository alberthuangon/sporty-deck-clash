import { reactive, ref, watch } from 'vue'
import { SHARD_COST } from './engine/economy.js'
import { createDemoHistory } from './demo/history.js'

const KEY = 'skd.v1'

/* New demo balances are independent of the illustrative settled history.
   Resetting creates fresh snapshots and makes only the first draw a winner. */
function initialState () {
  const history = createDemoHistory()
  return {
    diamonds: 5000,
    cash: 10000,
    tickets: 0,

    // Four starters plus one Rare, Epic and Legendary for the demo.
    ownedCards: {
      G1: { level: 1, shards: 0 },
      F1: { level: 1, shards: 0 },
      F2: { level: 1, shards: 0 },
      F3: { level: 1, shards: 0 },
      G3: { level: 1, shards: 0 },
      F12: { level: 1, shards: SHARD_COST.E[1] },
      F15: { level: 1, shards: 0 }
    },
    deck: { gk: 'G1', fw: 'F1', mf: 'F2', df: 'F3' },

    rank: { score: 0, tierIndex: 1, subtier: 2, peakNodes: ['b3', 'b2', 'b1', 's3'] },

    tasks: [
      { id: 't1', title: 'Log in to SportyBet', reward: 10, done: true, claimed: true, period: 'Daily' },
      { id: 't2', title: 'Bet ₦200 total on any sports / virtual product', reward: 30, done: true, claimed: false, period: 'Daily' },
      { id: 't3', title: 'Play 1 round of Instant Virtuals', reward: 20, done: false, claimed: false, period: 'Daily', progress: '0/1' }
    ],

    stats: { played: history.length, won: history.filter(m => m.won).length, pkWon: history.filter(m => m.won && m.wentToPk).length },

    /* Jackpot, PRD §6.7. Two lifecycles that must not be merged into one
       card: the standing state (pool / countdown / my tickets) is always
       there, and the draw is an event that happens once.
       Demo figures — there is no season scheduler here, just a date. */
    jackpot: {
      season: 1,
      pool: 2850182,
      totalTickets: 48310,
      drawAt: Date.now() + 6 * 86400000,
      lastDraw: null          // { season, won, prize, myTickets, totalTickets, winningTicket, seed }
    },

    /* Settled matches, newest first, capped at 20 for localStorage's sake.
       Each row carries its own script and deck snapshots, which is what makes
       replay free: the match was always "decide, then perform", so replaying
       is just handing the same script back to the same player. */
    history,

    // navigation
    currentScreen: 'home',
    overlay: null,

    // transient hand-off between screens
    pendingPack: null,
    /* the five cards of a pack that has been PAID FOR AND GRANTED, waiting to
       be shown. Not a promise of cards — a record of cards the player already
       holds, which is why the reveal can be interrupted by anything at all. */
    pendingPulls: null,
    pendingTier: null,
    upgradeTarget: null,
    cardTarget: null,
    rankUpView: null,       // which promotion the rank-up takeover is showing

    // live match context (built during the betting flow)
    match: null,
    lastResult: null,

    /* Stake held by a match that has been paid for but not yet settled.
       The match context itself lives outside the store (engine objects are
       not serialisable), so a reload during a match would otherwise lose the
       match and keep the money. load() refunds it — settlement stays
       single-shot either way, PRD §12.4. */
    pendingBet: null,

    // demo switches (settings screen)
    settings: {
      forcePkScenario: true,   // demo: condition the draw on a regular-time tie so PK always shows
      forceWin: false,         // presenter only: rig the player to win (see Settings)
      fastMatch: false,
      jackpotDemo: 'random'    // 'random' | 'won' | 'lost' — what the next unopened draw turns out to be
    },

    /* seenDraw holds the season whose draw has already been opened. A draw
       the player has not opened is sealed, and stays sealed across reloads. */
    flags: { packOpened: false, seenRankUp: false, seenDraw: 0, firstJackpotWinPending: true }
  }
}

function load () {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return initialState()
    const saved = JSON.parse(raw)
    const base = initialState()
    // shallow-merge so new fields added during development don't break saves
    const merged = { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) } }

    merged.flags = { ...base.flags, ...(saved.flags || {}), firstJackpotWinPending: saved.flags?.firstJackpotWinPending ?? (!saved.jackpot?.lastDraw && !saved.flags?.seenDraw) }
    merged.jackpot = { ...base.jackpot, ...(merged.jackpot || {}) }
    /* the draw date is a fixed demo value, so a save left alone for a week
       would count down past zero. Roll it forward rather than show "Draw in
       -3 days" — there is no season scheduler to do it properly. */
    if (merged.jackpot.drawAt <= Date.now()) merged.jackpot.drawAt = Date.now() + 6 * 86400000

    // a match was paid for but never settled (reload mid-flow): refund and reset
    if (merged.pendingBet) {
      merged.cash += merged.pendingBet.stake
      merged.pendingBet = null
      merged.currentScreen = 'home'
    }
    return merged
  } catch (e) {
    return initialState()
  }
}

export const store = reactive(load())

watch(
  () => JSON.stringify({
    diamonds: store.diamonds, cash: store.cash, tickets: store.tickets,
    ownedCards: store.ownedCards, deck: store.deck, rank: store.rank,
    tasks: store.tasks, stats: store.stats, settings: store.settings, flags: store.flags,
    pendingBet: store.pendingBet, history: store.history, jackpot: store.jackpot
  }),
  (v) => { try { localStorage.setItem(KEY, v) } catch (e) {} }
)

export function resetStore () {
  const fresh = initialState()
  Object.keys(store).forEach(k => { delete store[k] })
  Object.assign(store, fresh)
  try { localStorage.removeItem(KEY) } catch (e) {}
}

/* ---------- navigation ---------- */
export const TABS = ['cards', 'shop', 'home', 'tasks', 'history', 'rank']

/* Cards and History open a detail view WITHIN a tab screen, so there is a
   place to go back to that is not another screen. The screen registers how to
   leave it and the top bar's back arrow means the same thing everywhere;
   otherwise the only way out is a text link in the corner. Cleared on every
   navigation, so it can never point at a screen that is gone. */
export const screenBack = ref(null)

export function go (screen) {
  screenBack.value = null
  store.currentScreen = screen
}

export function isTab (screen) {
  return TABS.includes(screen)
}
