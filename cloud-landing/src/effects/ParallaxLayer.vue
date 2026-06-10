<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useParallax } from '@/composables/useParallax'
import { useDeviceDetect } from '@/composables/useDeviceDetect'

const props = withDefaults(defineProps<{
  speed?: number
}>(), {
  speed: 0.3,
})

const { isMobile } = useDeviceDetect()
const { parallaxStyle, setElementTop } = useParallax(isMobile.value ? 0 : props.speed)
const layerRef = ref<HTMLElement | null>(null)

onMounted(() => {
  if (layerRef.value) {
    const rect = layerRef.value.getBoundingClientRect()
    setElementTop(rect.top + window.scrollY)
  }
})
</script>

<template>
  <div
    ref="layerRef"
    class="parallax-layer"
    :style="isMobile ? {} : parallaxStyle"
  >
    <slot />
  </div>
</template>

<style scoped>
.parallax-layer {
  will-change: transform;
}
</style>