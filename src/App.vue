<template>
  <div class="phone-wrap">
    <div class="phone">
      <TopBar
        :title="screenTitle"
        :cash="store.cash"
        :diamonds="store.diamonds"
        :can-back="backTarget"
        @back="back"
        @title="titleTap"
      />

      <Transition :css="false" mode="out-in" @enter="onEnter" @leave="onLeave">
        <component :is="screenComponent" :key="store.currentScreen" :data-screen="store.currentScreen" class="screen" />
      </Transition>

      <TabBar v-if="isTabScreen" :tabs="tabs" :current="store.currentScreen" @nav="navTab" />

      <!-- Takeover layer. store.overlay has been declared since the first
           commit and never read; this is what it was waiting for. It sits
           above the tab bar on purpose — a takeover that leaves the tabs
           tappable is not a takeover (PRD §6.7.2). -->
      <DrawResult v-if="store.overlay === 'draw'" />
      <RankUp v-else-if="store.overlay === 'rankup'" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import gsap from 'gsap'
import { store, go, isTab, screenBack } from './store.js'
import { canUpgrade, CATALOGUE } from './game.js'
import TopBar from './components/TopBar.vue'
import TabBar from './components/TabBar.vue'
import DrawResult from './overlays/DrawResult.vue'
import RankUp from './overlays/RankUp.vue'

import Home from './screens/Home.vue'
import Tasks from './screens/Tasks.vue'
import Shop from './screens/Shop.vue'
import Cards from './screens/Cards.vue'
import Rank from './screens/Rank.vue'
import PackOpen from './screens/PackOpen.vue'
import Upgrade from './screens/Upgrade.vue'
import DeckEdit from './screens/DeckEdit.vue'
import TierSelect from './screens/TierSelect.vue'
import Matchmaking from './screens/Matchmaking.vue'
import Confirm from './screens/Confirm.vue'
import Toss from './screens/Toss.vue'
import Match from './screens/Match.vue'
import Result from './screens/Result.vue'
import Settings from './screens/Settings.vue'
import MotionLab from './screens/MotionLab.vue'
import History from './screens/History.vue'

const SCREENS = {
  home: { c: Home, title: 'SportyKickDeck', back: null },
  tasks: { c: Tasks, title: 'Daily Missions', back: null },
  shop: { c: Shop, title: 'Card Packs', back: null },
  cards: { c: Cards, title: 'My Collection', back: null },
  rank: { c: Rank, title: 'Rank', back: null },
  history: { c: History, title: 'Betting History', back: null },

  packopen: { c: PackOpen, title: 'Opening Pack', back: 'shop' },
  upgrade: { c: Upgrade, title: 'Upgrade Card', back: 'cards' },
  deckedit: { c: DeckEdit, title: 'Edit Squad', back: 'home' },
  tierselect: { c: TierSelect, title: 'Choose Arena', back: 'home' },
  matchmaking: { c: Matchmaking, title: 'Finding Opponent', back: 'tierselect' },
  confirm: { c: Confirm, title: 'Confirm Bet', back: 'tierselect' },
  toss: { c: Toss, title: 'Coin Toss', back: null },
  match: { c: Match, title: 'Live Match', back: null },
  result: { c: Result, title: 'Result', back: null },
  settings: { c: Settings, title: 'Demo Settings', back: 'home' },
  motionlab: { c: MotionLab, title: 'Motion Lab', back: 'settings' }

}

const screenComponent = computed(() => (SCREENS[store.currentScreen] || SCREENS.home).c)
const screenTitle = computed(() => (SCREENS[store.currentScreen] || SCREENS.home).title)
const isTabScreen = computed(() => isTab(store.currentScreen))
const screenTarget = computed(() => (SCREENS[store.currentScreen] || {}).back)
const backTarget = computed(() => !!screenBack.value || !!screenTarget.value)

const tabs = computed(() => [
  { id: 'cards', label: 'Cards', icon: '&#127183;', dot: CATALOGUE.some(c => canUpgrade(c.id)) },
  { id: 'shop', label: 'Shop', icon: '&#128717;', dot: store.diamonds >= 100 },
  { id: 'home', label: 'Play', icon: '&#9917;', dot: false },
  { id: 'tasks', label: 'Missions', icon: '&#128203;', dot: store.tasks.some(t => t.done && !t.claimed) },
  { id: 'history', label: 'History', icon: '&#129534;', dot: false },
  { id: 'rank', label: 'Rank', icon: '&#127942;', dot: false }
])

function navTab (id) { go(id) }
function back () {
  if (screenBack.value) { screenBack.value(); return }   // leave a detail view first
  if (screenTarget.value) go(screenTarget.value)
}

/* GSAP-driven screen transition (also proves the GSAP wiring) */
function onEnter (el, done) {
  gsap.fromTo(el, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out', onComplete: done })
}
function onLeave (el, done) {
  gsap.to(el, { autoAlpha: 0, y: -6, duration: 0.12, ease: 'power1.in', onComplete: done })
}

/* hidden demo hatch: tap the title 5x to reach settings */
const taps = ref(0)
let tapTimer = null
function titleTap () {
  taps.value += 1
  clearTimeout(tapTimer)
  tapTimer = setTimeout(() => { taps.value = 0 }, 1200)
  if (taps.value >= 5) { taps.value = 0; go('settings') }
}
</script>

<style>
.screen { display: flex; flex-direction: column; flex: 1; min-height: 0; }
</style>
