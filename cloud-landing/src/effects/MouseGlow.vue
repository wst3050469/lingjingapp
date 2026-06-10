<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useDeviceDetect } from '@/composables/useDeviceDetect'
import { useReducedMotion } from '@/composables/useReducedMotion'

const { isMobile } = useDeviceDetect()
const { prefersReducedMotion } = useReducedMotion()

const glowX = ref(-500)
const glowY = ref(-500)
let lastTime = 0
const THROTTLE_MS = 32

function handleMouseMove(e: MouseEvent) {
  const now = performance.now()
  if (now - lastTime < THROTTLE_MS) return
  lastTime = now
  glowX.value = e.clientX
  glowY.value = e.clientY
}

onMounted(() => {
  if (isMobile.value || prefersReducedMotion.value) return
  window.addEventListener('mousemove', handleMouseMove, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div
    v-if="!isMobile && !prefersReducedMotion"
    class="mouse-glow"
    :style="{ '--glow-x': glowX + 'px', '--glow-y': glowY + 'px' }"
    aria-hidden="true"
  />
</template>

<style scoped>
.mouse-glow {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    600px circle at var(--glow-x) var(--glow-y),
    rgba(0, 245, 255, 0.04),
    transparent 40%
  );
}
</style>