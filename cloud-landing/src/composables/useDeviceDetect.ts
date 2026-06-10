import { ref, onMounted, onUnmounted } from 'vue'
import type { EffectLevel, DeviceInfo } from '@/types'

export function useDeviceDetect() {
  const effectLevel = ref<EffectLevel>('full')
  const isMobile = ref(false)
  const isTablet = ref(false)
  const screenWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)

  function detect() {
    screenWidth.value = window.innerWidth
    isMobile.value = screenWidth.value <= 768
    isTablet.value = screenWidth.value > 768 && screenWidth.value <= 1024

    const cores = navigator.hardwareConcurrency || 4
    if (isMobile.value) {
      effectLevel.value = cores < 4 ? 'minimal' : 'reduced'
    } else if (cores < 4) {
      effectLevel.value = 'reduced'
    } else {
      effectLevel.value = 'full'
    }
  }

  let frameCount = 0
  let lastTime = performance.now()
  let fpsCheckId: number | null = null

  function checkFps() {
    frameCount++
    const now = performance.now()
    if (now - lastTime >= 1000) {
      const fps = frameCount
      frameCount = 0
      lastTime = now
      if (fps < 30 && effectLevel.value === 'full') {
        effectLevel.value = 'reduced'
      }
      if (fps < 20 && effectLevel.value === 'reduced') {
        effectLevel.value = 'minimal'
      }
    }
    fpsCheckId = requestAnimationFrame(checkFps)
  }

  onMounted(() => {
    detect()
    window.addEventListener('resize', detect)
    fpsCheckId = requestAnimationFrame(checkFps)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', detect)
    if (fpsCheckId !== null) cancelAnimationFrame(fpsCheckId)
  })

  const deviceInfo = ref<DeviceInfo>({
    get effectLevel() { return effectLevel.value },
    get isMobile() { return isMobile.value },
    get isTablet() { return isTablet.value },
    get screenWidth() { return screenWidth.value },
  })

  return { effectLevel, isMobile, isTablet, screenWidth, deviceInfo }
}