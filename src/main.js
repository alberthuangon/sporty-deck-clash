import { createApp } from 'vue'
import './styles/tokens.css'
import './styles/base.css'
import App from './App.vue'
import { store, go, resetStore } from './store.js'
import * as game from './game.js'

createApp(App).mount('#app')

/* Hatch for tools/layout and for driving the real build in a browser.
   currentScreen is deliberately NOT persisted, so a saved state cannot decide
   which screen to open on — navigation has to come from outside. */
window.__skd = { store, go, resetStore, game, ctx: game.ctx, matchView: game.matchView }
