<template><canvas ref="canvasEl" class="victory-particles" aria-hidden="true"></canvas></template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { reduced } from '../ui/motion.js'
const props = defineProps({ active: Boolean })
const canvasEl = ref(null)
let ctx, sprite, observer, frame = 0, width = 0, height = 0, epoch = 0, last = 0
// Deterministic visual noise never consumes the game's random draws.
const noise = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
const points = Array.from({ length: 208 }, (_, i) => ({ a: noise(i + 1) * Math.PI * 2, depth: noise(i + 49), speed: .6 + noise(i + 99), seed: noise(i + 211) }))
function stop () { if (frame) cancelAnimationFrame(frame); frame = 0 }
function draw (t) {
  if (!ctx || !width || !height) return
  ctx.clearRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'screen'
  // Three independently undulating light ribbons sweep across the viewport.
  for (let i = 0; i < 3; i++) {
    const wave = Math.sin(t * .8 + i * 1.9)
    ctx.beginPath(); ctx.moveTo(-width * .2, height * (.8 - i * .15))
    ctx.bezierCurveTo(width * (.35 + wave * .12), height * (.1 + i * .18), width * (1.3 - wave * .15), height * (.96 - i * .1), width * 1.15, height * (.23 + i * .18))
    for (const [line, alpha] of [[16, .035], [5, .12], [1.2, .65]]) {
      ctx.lineWidth = line; ctx.globalAlpha = alpha; ctx.strokeStyle = i === 1 ? '#fff1bd' : '#ffd278'; ctx.stroke()
    }
  }
  points.forEach((p, i) => {
    const angle = p.a + t * (.13 + p.speed * .08)
    const x = width * .5 + Math.cos(angle) * width * (.2 + p.depth * .55)
    const y = ((height * p.seed - t * (12 + p.speed * 16)) % height + height) % height
    ctx.globalAlpha = (.35 + p.depth * .55) * (.65 + Math.sin(t * 2 + p.a) * .35)
    if (i < 42) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.a + t * .7); ctx.fillStyle = '#ffd477'; ctx.fillRect(-2, -3, 2 + p.depth * 3, 3 + p.depth * 5); ctx.restore()
    } else {
      const size = i > 190 ? 19 + p.depth * 20 : 5 + p.depth * 11
      ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size)
      if (p.depth > .8 && i < 175) { ctx.fillStyle = '#fff4cf'; ctx.fillRect(x - .5, y - 3, 1, 6); ctx.fillRect(x - 3, y - .5, 6, 1) }
    }
  })
  ctx.globalAlpha = 1
}
function tick (now) { frame = 0; if (!props.active || reduced.value || document.hidden) return; if (now - last > 32) { draw((now - epoch) / 1000); last = now } frame = requestAnimationFrame(tick) }
function refresh () { stop(); if (!ctx) return; if (!props.active) { ctx.clearRect(0, 0, width, height); return } draw(reduced.value ? 0 : (performance.now() - epoch) / 1000); if (!reduced.value && !document.hidden) frame = requestAnimationFrame(tick) }
function resize () { const el = canvasEl.value, rect = el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); width = rect.width; height = rect.height; el.width = Math.max(1, Math.round(width * dpr)); el.height = Math.max(1, Math.round(height * dpr)); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); refresh() }
onMounted(() => {
  ctx = canvasEl.value.getContext('2d'); if (!ctx) return
  sprite = document.createElement('canvas'); sprite.width = 40; sprite.height = 40
  const s = sprite.getContext('2d'), g = s.createRadialGradient(20, 20, 0, 20, 20, 20)
  g.addColorStop(0, '#fff9dc'); g.addColorStop(.12, '#ffeab2'); g.addColorStop(.35, '#ffcc6244'); g.addColorStop(1, '#ffcc6200'); s.fillStyle = g; s.fillRect(0, 0, 40, 40)
  epoch = performance.now(); observer = new ResizeObserver(resize); observer.observe(canvasEl.value); document.addEventListener('visibilitychange', refresh); resize()
})
watch(() => props.active, refresh); watch(reduced, refresh)
onBeforeUnmount(() => { stop(); observer?.disconnect(); document.removeEventListener('visibilitychange', refresh) })
</script>
<style scoped>.victory-particles { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; pointer-events: none; }</style>
