<template>
  <div class="scroll pad">
    <h2 class="sec-title">Demo switches</h2>
    <div class="card pad rows">
      <label class="row">
        <div>
          <div class="rt">Force PK scenario</div>
          <div class="rs muted">
            Conditions the draw on a regular-time tie so the PK show always appears.
            Off = true sampling from the pricing distribution.
          </div>
        </div>
        <input type="checkbox" v-model="store.settings.forcePkScenario" />
      </label>
      <label class="row warn">
        <div>
          <div class="rt">Force a win <span class="tagd">presenter only</span></div>
          <div class="rs muted">
            Keeps redrawing until you win, so the promotion and jackpot-ticket
            beat always lands on stage. This rigs the outcome — the payout and
            rank figures stop representing the model while it is on.
          </div>
        </div>
        <input type="checkbox" v-model="store.settings.forceWin" />
      </label>
      <label class="row">
        <div>
          <div class="rt">Fast match</div>
          <div class="rs muted">Plays the match timeline at 3x for rehearsals.</div>
        </div>
        <input type="checkbox" v-model="store.settings.fastMatch" />
      </label>
    </div>

    <h2 class="sec-title" style="margin-top:18px">Tools</h2>
    <div class="card pad">
      <div class="rs muted" style="margin-bottom:10px">
        Replay a single attack wave and retune the beat lengths live.
      </div>
      <button class="btn" @click="go('motionlab')">Motion lab</button>
    </div>

    <h2 class="sec-title" style="margin-top:18px">Danger zone</h2>
    <div class="card pad">
      <div class="rs muted" style="margin-bottom:10px">
        Wipes localStorage and returns to the demo starting state
        (80 ◆ · ₦5,000 · Bronze III 40/50).
      </div>
      <button class="btn" style="background:var(--red)" @click="doReset">Reset demo state</button>
    </div>

    <div class="build muted">build {{ build }}</div>
  </div>
</template>

<script setup>
import { store, resetStore, go } from '../store.js'
const build = import.meta.env.MODE
function doReset () { resetStore(); go('home') }
</script>

<style scoped>
.rows { display: flex; flex-direction: column; gap: 14px; }
.row { display: flex; align-items: flex-start; gap: 12px; }
.row input { margin-left: auto; width: 20px; height: 20px; accent-color: var(--cta); flex: 0 0 auto; }
.rt { font-weight: 700; margin-bottom: 2px; }
.rs { font-size: 12px; line-height: 1.4; }
.row.warn .rt { color: #F5A524; }
.tagd { font-size: 9px; background: #5A4512; color: #F5A524; border-radius: 3px; padding: 1px 5px; margin-left: 4px; vertical-align: middle; letter-spacing: .04em; }
.build { font-size: 11px; text-align: center; margin-top: 22px; }
</style>
