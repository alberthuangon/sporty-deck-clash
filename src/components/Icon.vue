<template>
  <svg
    class="icon" :style="{ width: px, height: px }"
    viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false"
  ><component v-for="(p, i) in shape" :key="i" :is="p[0]" v-bind="p[1]" /></svg>
</template>

<script setup>
/* One icon, drawn from src/ui/icons.js.

   A component rather than a bag of markup strings, for three reasons: it is
   the only way to be rid of the project's single v-html; it gives one place
   to hold size, stroke and aria-hidden rather than ten; and it is the shape
   everything else here already has (CardFace, RadarChart, PowerStars...).

   Size defaults to 1em so an icon sitting in a line of text grows and shrinks
   with the text around it. The tab bar passes a fixed pixel size instead,
   because its icons are not in a sentence. */
import { computed } from 'vue'
import { ICONS } from '../ui/icons.js'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: null }   // px number, or any CSS length
})
const shape = computed(() => ICONS[props.name] || [])
const px = computed(() =>
  props.size == null ? '1em' : (typeof props.size === 'number' ? props.size + 'px' : props.size))
</script>

<style scoped>
/* inline-block + the baseline nudge so an icon in a run of text sits on the
   text's centre rather than on its baseline; block would break the line box
   and `vertical-align: middle` alone leaves it floating high at these sizes */
.icon { display: inline-block; vertical-align: -0.125em; flex: none; }
</style>
