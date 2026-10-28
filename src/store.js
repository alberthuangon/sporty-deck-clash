import { reactive, ref, watch } from 'vue'
import { SHARD_COST } from './engine/economy.js'

const KEY = 'skd.v1'

/* Demo starting state — guide §6.
   Okonkwo arrives with its shard requirement already collected so that the
   "shards full -> UPGRADE lights up" beat fires the moment the pack reveals it.
   Shard counts always follow the PRD §6.3 curve (E Lv.1->2 = 1 shard). */
function initialState () {
  return {
    /* 1000, up from 80, and the old number was worse than it looked: the
       cheapest pack is 100 diamonds (economy.js), so a new player could not
       open ANY pack, not merely not a gold one. 1000 buys two gold packs at
       450 each, which is wider than the ask ("should be able to afford a gold
       pack") and leaves the first pull a choice rather than a wait. */
    diamonds: 1000,
    cash: 5000,
    tickets: 0,

    // level 0 = card not owned yet, shards already collected
    ownedCards: {
      G1: { level: 1, shards: 0 },
      F1: { level: 1, shards: 0 },
      F2: { level: 1, shards: 0 },
      F3: { level: 1, shards: 0 },
      F12: { level: 0, shards: SHARD_COST.E[1] }
    },
    deck: { gk: 'G1', fw: 'F1', mf: 'F2', df: 'F3' },

    rank: { score: 40, tierIndex: 0, subtier: 3, peakNodes: [] },

    tasks: [
      { id: 't1', title: 'Log in to SportyBet', reward: 10, done: true, claimed: true, period: 'Daily' },
      { id: 't2', title: 'Bet ₦200 total on any sports / virtual product', reward: 30, done: true, claimed: false, period: 'Daily' },
      { id: 't3', title: 'Play 1 round of Instant Virtuals', reward: 20, done: false, claimed: false, period: 'Daily', progress: '0/1' }
    ],

    stats: { played: 0, won: 0, pkWon: 0 },

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
    history: [],

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
    flags: { packOpened: false, seenRankUp: false, seenDraw: 0 }
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
