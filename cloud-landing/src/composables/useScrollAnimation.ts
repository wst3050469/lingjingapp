import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface ScrollAnimationOptions {
  threshold?: number
  rootMargin?: string
  staggerDelay?: number
}

export function useScrollAnimation<T extends HTMLElement>(
  options: ScrollAnimationOptions = {}
) {
  const { threshold = 0.1, rootMargin = '0px 0px -60px 0px', staggerDelay = 100 } = options
  const elementRef: Ref<T | null> = ref(null)
  const isVisible = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (!elementRef.value) return
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisible.value = true
            const children = (entry.target as HTMLElement).querySelectorAll('[data-stagger]')
            children.forEach((child, index) => {
              ;(child as HTMLElement).style.transitionDelay = `${index * staggerDelay}ms`
              child.classList.add('is-visible')
            })
            observer?.unobserve(entry.target)
          }
        })
      },
      { threshold, rootMargin }
    )
    observer.observe(elementRef.value)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return { elementRef, isVisible }
}