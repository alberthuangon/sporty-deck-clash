<template>
  <div class="ru">
    <div class="ru-in">
      <div class="ru-kicker">PROMOTED</div>
      <!-- The words land first and the burst plays around them. §2.1: an
           animation may decorate information, never gate it — the player
           already read "PROMOTED" on the result screen, and this screen is
           not allowed to make them wait to read it again. -->
      <div class="ru-tier" :class="tierClass" ref="tierEl">{{ view.label }}</div>
      <div class="ru-reward" ref="rewardEl">
        <span v-if="view.reward.diamonds" class="rw"><i class="gem">◆</i> {{ view.reward.diamonds }}</span>
        <span v-if="view.reward.tickets" class="rw"><Icon name="ticket" /> {{ view.reward.tickets }} jackpot tickets</span>
        <span v-if="!view.reward.diamonds && !view.reward.tickets" class="rw muted">no reward node here</span>
      </div>

      <div class="ru-note">
        Climbing the reward road pays once per season, at your peak.
      </div>
      <button class="btn ru-go" @click="dismiss">Close</button>
    </div>

    <Burst ref="burstRef" :count="20" :radius="170" />
  </div>
</template>

<script setup>
/* The rank-up takeover. There is no watcher that forces this open: the one
   App.vue used to have was removed when the jackpot draw moved to
   "the player opens it", and the same reasoning applies here — a takeover
   that arrives unasked is interrupting the result the player is reading.
   Result.vue's promotion block is the door. */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Icon from '../components/Icon.vue'
import gsap from 'gsap'
import Burst from '../components/Burst.vue'
import { store } from '../game.js'
import { uiPlay, UI_TIME } from '../ui/motion.js'
import { flyTo } from '../ui/flyIn.js'

const view = computed(() => store.rankUpView || { label: '', reward: {} })
const burstRef = ref(null)
/* The tier name takes the tier's own colour, not the win green. Promotion is
   not the same event as winning — it can land on the back of a match you
   lost — and the rank screen's hex badge was already bronze, so this only
   spreads a decision that had already been made. */
const tierClass = computed(() => {
  const t = (view.value.label || '').split(' ')[0].toLowerCase()
  return ['bronze', 'silver', 'gold'].includes(t) ? 't-' + t : 't-bronze'
})
const tierEl = ref(null)
const rewardEl = ref(null)
let anim = null

/* The rewards were credited by finishMatch long before this screen opened —
   this is the player being shown where they went, not the transfer itself.
   Launched BEFORE the overlay closes, so the chips still have a rect to
   leave from; the tokens live on .phone, so they survive the unmount.
   Tickets fly to the Rank tab rather than the wallet: the top bar has no
   ticket chip, and the reward road is where a ticket actually goes. */
function dismiss () {
  if (anim) anim.skip()
  const chip = rewardEl.value && rewardEl.value.querySelector('.rw')
  const r = view.value.reward
  if (chip && r.diamonds) flyTo(chip, 'diamonds', { glyph: '◆' })
  else if (chip && r.tickets) flyTo(chip, '[data-tab="rank"]', { icon: 'ticket', count: 5 })
  store.overlay = null
  store.rankUpView = null
}

/* onMounted, not a watcher with `immediate`: the burst's shards and the tier
   line do not exist during setup, and an animation built then runs against
   null. That is the bug class this repo has shipped three times. */
onMounted(() => {
  const dur = UI_TIME.rankUp
  anim = uiPlay('rankUp', tl => {
    tl.add(burstRef.value.timeline(), 0)
    tl.fromTo(tierEl.value, { scale: 0.7, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: dur * 0.3, ease: 'back.out(2)' }, 0)
    tl.fromTo(rewardEl.value, { y: 10, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: dur * 0.25, ease: 'power2.out' }, dur * 0.22)
  }, { interruptible: dur > 1 })
})
onUnmounted(() => { if (anim) anim.cancel() })
</script>

<style scoped>
/* a takeover: above the top bar and the tab bar, both of which sit at 20 */
.ru {
  position: absolute; inset: 0; z-index: 60;
  background: radial-gradient(120% 60% at 50% 16%, var(--good-glow), var(--bg) 70%);
  display: flex; flex-direction: column;
  overflow-y: auto;
}
.ru-in {
  padding: 28px 16px 20px; flex: 1;
  display: flex; flex-direction: column; justify-content: safe center;
}
/* centred on the tier line, which is what is being celebrated — the default
   origin is tuned for the draw takeover's taller headline block */
.ru :deep(.burst) { top: 43%; }
.ru-kicker {
  font-size: 10px; font-weight: 800; letter-spacing: .18em;
  color: var(--text-2); text-align: center;
}
.ru-tier {
  font-size: 30px; font-weight: 800; text-align: center;
  margin-top: 10px; min-height: 40px; line-height: 40px;
}
.ru-reward {
  display: flex; gap: 14px; justify-content: center; margin-top: 16px;
  min-height: 34px; align-items: center;
}
.rw {
  background: var(--surface-hi); border-radius: var(--r-sm);
  padding: 7px 11px; font-weight: 700; font-size: 13px;
  display: inline-flex; align-items: center; gap: 5px;
}
.gem { color: var(--diamond); font-style: normal; }
.ru-note { font-size: 12px; line-height: 1.5; text-align: center; margin: 20px 10px 12px; color: var(--text-2); }
.ru-go { margin-top: 22px; flex: 0 0 auto; }
.ru-tier.t-bronze { color: var(--tier-bronze); }
.ru-tier.t-silver { color: var(--tier-silver); }
.ru-tier.t-gold { color: var(--tier-gold); }
</style>
