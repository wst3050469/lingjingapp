<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useDeviceDetect } from '@/composables/useDeviceDetect'
import { useReducedMotion } from '@/composables/useReducedMotion'

const canvas = ref<HTMLCanvasElement | null>(null)
const { effectLevel, isMobile } = useDeviceDetect()
const { prefersReducedMotion } = useReducedMotion()

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
}

let particles: Particle[] = []
let animationId: number | null = null
let mouseX = -1000
let mouseY = -1000
let ctx: CanvasRenderingContext2D | null = null

const MAX_PARTICLES_DESKTOP = 120
const MAX_PARTICLES_MOBILE = 40
const CONNECTION_DISTANCE = 120
const MOUSE_INFLUENCE_RADIUS = 200

function initParticles(width: number, height: number) {
  const count = isMobile.value ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: Math.random() * 1.5 + 0.5,
    opacity: Math.random() * 0.5 + 0.2,
  }))
}

function draw() {
  if (!ctx || !canvas.value) return
  const { width, height } = canvas.value
  ctx.clearRect(0, 0, width, height)

  const showConnections = effectLevel.value !== 'minimal' && !prefersReducedMotion.value

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy

    if (p.x < 0 || p.x > width) p.vx *= -1
    if (p.y < 0 || p.y > height) p.vy *= -1

    const dx = mouseX - p.x
    const dy = mouseY - p.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < MOUSE_INFLUENCE_RADIUS && dist > 0) {
      const force = (MOUSE_INFLUENCE_RADIUS - dist) / MOUSE_INFLUENCE_RADIUS * 0.02
      p.vx += dx / dist * force
      p.vy += dy / dist * force
    }

    p.vx *= 0.99
    p.vy *= 0.99

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(0, 245, 255, ${p.opacity})`
    ctx.fill()
  }

  if (showConnections) {
    const gridSize = CONNECTION_DISTANCE
    const grid = new Map()
    for (let g = 0; g < particles.length; g++) {
      const gx = Math.floor(particles[g].x / gridSize)
      const gy = Math.floor(particles[g].y / gridSize)
      const key = `${gx},${gy}`
      if (!grid.has(key)) grid.set(key, [])
      grid.get(key).push(g)
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const gx = Math.floor(p.x / gridSize)
      const gy = Math.floor(p.y / gridSize)
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const neighborKey = `${gx + ox},${gy + oy}`
          const cell = grid.get(neighborKey)
          if (!cell) continue
          for (const j of cell) {
            if (j <= i) continue
            const q = particles[j]
            const cdx = p.x - q.x
            const cdy = p.y - q.y
            const cdistSq = cdx * cdx + cdy * cdy
            if (cdistSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
              const cdist = Math.sqrt(cdistSq)
              const alpha = (1 - cdist / CONNECTION_DISTANCE) * 0.15
              ctx.beginPath()
              ctx.moveTo(p.x, p.y)
              ctx.lineTo(q.x, q.y)
              ctx.strokeStyle = `rgba(0, 245, 255, ${alpha})`
              ctx.lineWidth = 0.5
              ctx.stroke()
            }
          }
        }
      }
    }
  }

  animationId = requestAnimationFrame(draw)
}

function handleResize() {
  if (!canvas.value) return
  const dpr = window.devicePixelRatio || 1
  canvas.value.width = window.innerWidth * dpr
  canvas.value.height = window.innerHeight * dpr
  canvas.value.style.width = `${window.innerWidth}px`
  canvas.value.style.height = `${window.innerHeight}px`
  ctx = canvas.value.getContext('2d')
  if (ctx) ctx.scale(dpr, dpr)
  initParticles(window.innerWidth, window.innerHeight)
}

function handleMouseMove(e: MouseEvent) {
  mouseX = e.clientX
  mouseY = e.clientY
}

onMounted(() => {
  if (prefersReducedMotion.value) return
  handleResize()
  window.addEventListener('resize', handleResize)
  if (!isMobile.value) {
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
  }
  animationId = requestAnimationFrame(draw)
})

onUnmounted(() => {
  if (animationId !== null) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <canvas
    v-if="!prefersReducedMotion"
    ref="canvas"
    class="particle-bg"
    aria-hidden="true"
  />
</template>

<style scoped>
.particle-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
</style>