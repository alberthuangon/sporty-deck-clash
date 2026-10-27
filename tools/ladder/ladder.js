/* Throwaway: the four rarities side by side at all three sizes. The layout
   sweep cannot reach E or L (richCollection owns none, and a standard pack
   almost never pulls one), so the ladder has to be staged by hand. */
import { createApp, h } from 'vue'
import CardFace from '../../src/components/CardFace.vue'
import { buildCard } from '../../src/engine/cards.js'
import cardData from '../../src/data/cards.json'
const CARDS = cardData.cards
import '../../src/styles/tokens.css'
import '../../src/styles/base.css'

const pick = r => CARDS.find(c => c.rarity === r)
const defs = ['C', 'R', 'E', 'L'].map(pick)
const WIDTH = { sm: 130, md: 112, lg: 190 }

const row = (size, extra = {}) => h('div', { class: 'lrow' }, [
  h('div', { class: 'llab' }, size + (extra.selected ? ' · selected' : extra.dim ? ' · dim' : '')),
  h('div', { class: 'lcards' }, defs.map(d => h('div', { style: { width: WIDTH[size] + 'px' } },
    [h(CardFace, { card: buildCard(d, 3), size, ...extra })])))
])

createApp({
  render: () => h('div', { class: 'lwrap' }, [
    h('div', { class: 'lhead' }, 'C  /  R  /  E  /  L'),
    row('sm'), row('md'), row('lg'),
    row('sm', { selected: true }), row('sm', { dim: true })
  ])
}).mount('#app')
