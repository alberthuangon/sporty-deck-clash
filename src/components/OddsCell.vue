<template>
  <div class="oc" :class="{ big }">
    <span class="oc-l">{{ label }}</span>
    <span class="oc-v">{{ odds.toFixed(2) }}</span>
  </div>
</template>
<script setup>
defineProps({ label: String, odds: Number, big: Boolean })
</script>
<style scoped>
.oc {
  background: var(--surface-hi); border-radius: var(--r-sm);
  padding: 7px 10px; display: flex; align-items: center; justify-content: space-between;
  gap: 10px; min-width: 0;
}
.oc-l { font-size: 11px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oc-v { color: var(--green); font-weight: 700; font-size: 15px; font-variant-numeric: tabular-nums; }
.big { padding: 12px; }
.big .oc-v { font-size: 22px; }
</style>
