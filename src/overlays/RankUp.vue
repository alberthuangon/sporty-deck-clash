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
        <span v-if="view.reward.diamonds" class="rw"><DiamondIcon :size="22" /> {{ view.reward.diamonds }}</span>
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
import DiamondIcon from '../components/DiamondIcon.vue'
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
  /* The same beam-from-above as a winning draw, in the tier's colour. Kept on
     .ru rather than .ru-in so adding .ru.silver / .ru.gold later is one rule
     each rather than a restructure.

     The stripe matters more than it looks. Unlike the draw takeover, this one
     stays CENTRED: it is a stamp, not a ledger — one tier name and one reward
     chip — and a stamp belongs in the middle, so the room around it is margin
     rather than space waiting to be filled. Margin still has to look
     deliberate though, and measured as luminance spread across the empty
     region a bare radial came out at 1.23 against the draw's 2.69. The stripe
     is what makes the emptiness read as a lit room rather than as nothing.

     The bottom wash is the TIER's, not --good-glow. Promotion is not winning
     — it can land on the back of a match you lost — so the takeover had no
     business sitting on the colour the winning draw uses. Same luminance, so
     only the hue moved. */
  background:
    repeating-linear-gradient(96deg, rgba(201,139,75,.05) 0 2px, transparent 2px 26px),
    radial-gradient(150% 72% at 50% 6%, rgba(201,139,75,.26), transparent 62%),
    radial-gradient(120% 60% at 50% 12%, var(--tier-bronze-glow), var(--bg) 70%);
  display: flex; flex-direction: column;
  overflow-y: auto;
}
.ru-in {
  padding: 28px 16px 20px; flex: 1;
  display: flex; flex-direction: column; justify-content: safe center;
}
/* Centred on the tier line, which is the thing being celebrated, and the
   number is MEASURED rather than tuned by eye: the line's centre sits at
   398.8px of a 932px takeover, so 42.8%.

   This figure is anchored to something the layout can move. A three-band
   layout was tried and reverted; while it was in, the tier line sat at 9.8%
   and this rule still said 43%, which would have fired the burst 309px below
   the words it is cheering. Nothing would have caught it — the element
   exists, the timeline runs, the gate is green, and a still frame cannot
   photograph a burst. So if the distribution in .ru-in ever changes again,
   re-measure this line rather than assuming it survived. */
.ru :deep(.burst) { top: 42.8%; }
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
