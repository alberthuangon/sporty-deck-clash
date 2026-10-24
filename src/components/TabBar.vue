<template>
  <nav class="tabbar">
    <button
      v-for="t in tabs" :key="t.id"
      class="tab" :class="{ active: current === t.id }"
      @click="$emit('nav', t.id)"
    >
      <span class="ic" v-html="t.icon"></span>
      <span class="lb">{{ t.label }}</span>
      <i v-if="t.dot" class="tdot"></i>
    </button>
  </nav>
</template>

<script setup>
defineProps({ tabs: Array, current: String })
defineEmits(['nav'])
</script>

<style scoped>
.tabbar {
  flex: 0 0 var(--tabbar-h);
  height: var(--tabbar-h);
  background: var(--surface-lo);
  border-top: 1px solid var(--divider);
  display: flex;
  z-index: 20;
}
.tab {
  flex: 1; position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; color: var(--text-2); font-size: 10px; font-weight: 600;
  padding-top: 3px;
}
.tab.active { color: var(--text); }
.tab.active::before {
  content: ''; position: absolute; top: 0; left: 24%; right: 24%;
  height: 2px; background: var(--green); border-radius: 0 0 2px 2px;
}
.ic { font-size: 19px; line-height: 1; }
.tab.active .ic { filter: drop-shadow(0 0 6px rgba(50,206,98,.5)); }
.tdot {
  position: absolute; top: 6px; right: calc(50% - 20px);
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--red); box-shadow: 0 0 0 2px var(--surface-lo);
}
</style>
