<template><img class="diamond-art" :src="diamond" :width="size" :height="size" :style="{ width:size+'px', height:size+'px' }" alt="" aria-hidden="true" decoding="async" draggable="false"></template>
<script setup>
import diamond from '../assets/missions-art/diamond.webp'
defineProps({ size:{type:Number,default:20} })
</script>
<style scoped>.diamond-art { display:inline-block; object-fit:contain; vertical-align:middle; flex:none; }</style>
