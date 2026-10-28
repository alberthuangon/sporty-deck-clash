<template><canvas ref="canvasEl" class="pack-particles" aria-hidden="true"></canvas></template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { reduced } from '../ui/motion.js'

const props = defineProps({ active:Boolean })
const canvasEl = ref(null)
let ctx, observer, sprite, frame=0, width=0, height=0, last=0, epoch=0
// Fixed phases give the field depth without consuming the game's random draws.
const noise = n => { const x=Math.sin(n*127.1+311.7)*43758.5453; return x-Math.floor(x) }
const particles=Array.from({length:72},(_,i)=>({phase:noise(i+1)*Math.PI*2,depth:noise(i+83),speed:.65+noise(i+149)*.8,seed:noise(i+243)}))
function stop() { if(frame) cancelAnimationFrame(frame); frame=0 }
function position(p,i,t) {
  if(i<42) {
    const a=p.phase+t*(.10+p.speed*.07)
    return {x:width*.5+Math.cos(a)*width*(.26+p.depth*.34),y:height*.43+Math.sin(a)*height*(.18+p.depth*.31)}
  }
  return {x:width*p.seed+Math.sin(t*.38+p.phase)*width*.065,y:((height*p.depth-t*(9+p.speed*9))%height+height)%height}
}
function draw(t) {
  if(!ctx || !width || !height) return
  ctx.clearRect(0,0,width,height)
  ctx.globalCompositeOperation='screen'
  particles.forEach((p,i)=>{
    const at=position(p,i,t), behind=position(p,i,t-.16)
    const alpha=(.26+p.depth*.5)*(.65+.35*Math.sin(t*1.8+p.phase))
    ctx.globalAlpha=alpha
    if(i<42) {
      ctx.strokeStyle='#ffe0a0';ctx.lineWidth=.5+p.depth*.6
      ctx.beginPath();ctx.moveTo(behind.x,behind.y);ctx.lineTo(at.x,at.y);ctx.stroke()
    }
    const size=7+p.depth*12
    ctx.drawImage(sprite,at.x-size/2,at.y-size/2,size,size)
    if(p.depth>.68) {
      ctx.fillStyle='#fff5cf';ctx.fillRect(at.x-.6,at.y-2.7,.8,5.4);ctx.fillRect(at.x-2.7,at.y-.6,5.4,.8)
    }
  })
  ctx.globalAlpha=1
}
function tick(now) {
  frame=0
  if(!props.active || reduced.value || document.hidden) return
  if(now-last>=32) { draw((now-epoch)/1000);last=now }
  frame=requestAnimationFrame(tick)
}
function refresh() {
  stop()
  if(!ctx || !props.active) { ctx?.clearRect(0,0,width,height);return }
  draw(reduced.value?0:(performance.now()-epoch)/1000)
  if(!reduced.value && !document.hidden && width && height) frame=requestAnimationFrame(tick)
}
function resize() {
  const canvas=canvasEl.value,r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2)
  width=r.width;height=r.height
  canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr))
  ctx.setTransform(dpr,0,0,dpr,0,0)
  refresh()
}
onMounted(()=>{
  ctx=canvasEl.value.getContext('2d')
  if(!ctx) return
  sprite=document.createElement('canvas');sprite.width=40;sprite.height=40
  const s=sprite.getContext('2d'),g=s.createRadialGradient(20,20,0,20,20,20)
  g.addColorStop(0,'#fff9dc');g.addColorStop(.10,'#ffe8aa');g.addColorStop(.28,'#ffce6277');g.addColorStop(1,'#ffce6200')
  s.fillStyle=g;s.fillRect(0,0,40,40)
  epoch=performance.now()
  observer=new ResizeObserver(resize);observer.observe(canvasEl.value)
  document.addEventListener('visibilitychange',refresh)
  resize()
})
watch([()=>props.active,reduced],refresh,{flush:'post'})
onBeforeUnmount(()=>{stop();observer?.disconnect();document.removeEventListener('visibilitychange',refresh)})
</script>
<style scoped>.pack-particles { position:absolute;inset:0;width:100%;height:100%;pointer-events:none; }</style>
