import { ref, computed, onMounted, onUnmounted, type ComputedRef, type CSSProperties } from 'vue'

export function useParallax(speed: number = 0.3) {
  const translateY = ref(0)
  const elementTop = ref(0)
  let rafId: number | null = null
  let ticking = false

  function updatePosition() {
    const scrollY = window.scrollY
    const viewportCenter = scrollY + window.innerHeight / 2
    const offset = (viewportCenter - elementTop.value) * speed * -0.1
    translateY.value = Math.max(-100, Math.min(100, offset))
    ticking = false
  }

  function onScroll() {
    if (!ticking) {
      ticking = true
      rafId = requestAnimationFrame(updatePosition)
    }
  }

  function setElementTop(top: number) {
    elementTop.value = top
  }

  onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    if (rafId !== null) cancelAnimationFrame(rafId)
  })

  const parallaxStyle: ComputedRef<CSSProperties> = computed(() => ({
    transform: `translateY(${translateY.value}px)`,
    willChange: 'transform',
  }))

  return { translateY, parallaxStyle, setElementTop }
}