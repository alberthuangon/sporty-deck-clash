<template>
  <img class="pack-artwork" :src="tier === 'gold' ? gold : standard" width="600" height="900" alt="" aria-hidden="true" decoding="async">
</template>
<script setup>
import standard from '../assets/shop-art/standard-pack.webp'
import gold from '../assets/shop-art/gold-pack.webp'
defineProps({ tier: { type: String, default: 'standard' } })
</script>
<style scoped>
.pack-artwork { display:block; width:100%; height:100%; object-fit:contain; }
</style>
