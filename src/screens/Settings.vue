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
      <label class="row">
        <div>
          <div class="rt">Fast match</div>
          <div class="rs muted">Plays the match timeline at 3x for rehearsals.</div>
        </div>
        <input type="checkbox" v-model="store.settings.fastMatch" />
      </label>
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
.build { font-size: 11px; text-align: center; margin-top: 22px; }
</style>
