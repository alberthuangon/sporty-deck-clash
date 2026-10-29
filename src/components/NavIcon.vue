<template>
  <svg class="nav-icon" :class="'nav-' + name" viewBox="0 0 32 32" width="28" height="28" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient :id="metalId" x1="6" y1="3" x2="25" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="var(--nav-metal-hi)"/><stop offset=".48" stop-color="var(--nav-metal-mid)"/><stop offset="1" stop-color="var(--nav-metal-lo)"/></linearGradient>
      <linearGradient :id="bodyId" x1="7" y1="5" x2="26" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="var(--nav-fill-hi)"/><stop offset="1" stop-color="var(--nav-fill-lo)"/></linearGradient>
    </defs>
    <g :stroke="metal" stroke-width="1.6">
      <template v-if="name === 'cards'">
        <path d="m8.4 7.3-3.3.7a2.1 2.1 0 0 0-1.6 2.5l3.1 16a2.1 2.1 0 0 0 2.5 1.6l6.6-1.3" :fill="body"/>
        <rect x="10" y="3.5" width="17.3" height="23" rx="3" :fill="body"/>
        <path d="M12.9 6.7h4.4M13 23.1h11.2" stroke-opacity=".6"/>
        <circle cx="18.7" cy="12" r="3" :fill="metal" stroke="none"/>
        <path d="M13.7 20v-1.1a5 5 0 0 1 10 0V20" :fill="metal" stroke="none"/>
        <path d="M12 4.9h12.9" stroke="#fff" stroke-opacity=".32" stroke-width=".8"/>
      </template>
      <template v-else-if="name === 'shop'">
        <path d="m8.1 3.5 2 1.1 2-1.1 2 1.1 2-1.1 2 1.1 2-1.1 2 1.1 2-1.1v25l-2-1.1-2 1.1-2-1.1-2 1.1-2-1.1-2 1.1-2-1.1-2 1.1Z" :fill="body"/>
        <path d="M8.4 8h15.4M8.4 24h15.4" stroke-opacity=".6"/>
        <path d="m16 10.7 5.2 3v5.9L16 22.5l-5.2-2.9v-5.9Z" :fill="metal" fill-opacity=".22"/>
        <path d="m16 13.2 2.9 2.1-1.1 3.4h-3.6l-1.1-3.4Z" :fill="metal" stroke="none"/>
        <path d="M10 5.6v.8M13 5.6v.8M16 5.6v.8M19 5.6v.8M22 5.6v.8" stroke-width=".8" stroke-opacity=".6"/>
      </template>
      <template v-else-if="name === 'play'">
        <circle cx="16" cy="16" r="12" :fill="body"/>
        <path d="m16 10.4 5.3 3.9-2 6.2h-6.6l-2-6.2Z" :fill="metal" stroke-width="1.25"/>
        <path d="M16 10.4V4M21.3 14.3l6.1-2M19.3 20.5l3.8 5.3M12.7 20.5l-3.8 5.3M10.7 14.3l-6.1-2" stroke-width="1.4"/>
        <path d="m11.2 5.1 4.8 2.3 4.8-2.3M27.4 12.2l-3.6 3.6 1.5 7.8M9 25.8l.5-4.8-5.2-4.1" stroke-width="1" stroke-opacity=".4"/>
        <path d="M8 10a10 10 0 0 1 6-3.7" stroke="#fff" stroke-opacity=".45" stroke-width="1.1"/>
      </template>
      <template v-else-if="name === 'missions'">
        <rect x="6.4" y="6.1" width="19.2" height="22" rx="3" :fill="body"/>
        <rect x="11.2" y="3.5" width="9.6" height="5.4" rx="1.8" :fill="metal" stroke="none"/>
        <path d="m11 17 3.2 3.2 6.7-7" stroke-width="2.2"/>
        <path d="M11.2 24.5h9.6" stroke-width="1.1" stroke-opacity=".5"/>
        <path d="M8.4 9.8v11.7" stroke="#fff" stroke-opacity=".22" stroke-width=".8"/>
      </template>
      <template v-else-if="name === 'history'">
        <circle cx="16.4" cy="16.3" r="8.7" :fill="body" stroke="none"/>
        <path d="M5.6 12a11.5 11.5 0 1 1-.2 8.1" stroke-width="1.9"/>
        <path d="M5.6 5.8v6.5h6.5" stroke-width="1.9"/>
        <path d="M16.4 9.7v6.7l4.2 2.5" stroke-width="2"/>
        <circle cx="16.4" cy="16.4" r="1.6" :fill="metal" stroke="none"/>
        <path d="M25.6 16.3a9.2 9.2 0 0 1-9.2 9.2" stroke-width=".9" stroke-opacity=".4"/>
      </template>
      <template v-else-if="name === 'rank'">
        <path d="M16 3 27 7.4v8.3c0 6-6.1 10.9-11 13.3C11.1 26.6 5 21.7 5 15.7V7.4Z" :fill="body"/>
        <path d="m16 6.4 7.9 3.1v6.2c0 4-3.9 7.8-7.9 10-4-2.2-7.9-6-7.9-10V9.5Z" stroke-width=".9" stroke-opacity=".4"/>
        <path d="m16 9.3 2 4.1 4.5.7-3.3 3.2.8 4.5-4-2.1-4 2.1.8-4.5-3.3-3.2 4.5-.7Z" :fill="metal" stroke="none"/>
        <path d="M7.1 9.3v5.8" stroke="#fff" stroke-opacity=".3" stroke-width=".9"/>
      </template>
    </g>
  </svg>
</template>
<script setup>
import { useId } from 'vue'
defineProps({ name: { type: String, required: true } })
// Each mounted navigation owns its gradient IDs, including UI previews.
const id = useId().replace(/:/g, '')
const metalId = 'nav-metal-' + id, bodyId = 'nav-body-' + id
const metal = `url(#${metalId})`, body = `url(#${bodyId})`
</script>
<style scoped>
.nav-icon { display:block; flex:none; overflow:visible; }
</style>
