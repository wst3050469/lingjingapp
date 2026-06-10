<script setup lang="ts">
import { useScrollAnimation } from '@/composables/useScrollAnimation'

withDefaults(defineProps<{
  tag?: string
  class?: string
}>(), {
  tag: 'section',
})

const { elementRef, isVisible } = useScrollAnimation<HTMLElement>()
</script>

<template>
  <component
    :is="tag"
    ref="elementRef"
    :class="['section-wrapper', { 'is-visible': isVisible }, $props.class]"
  >
    <slot />
  </component>
</template>

<style scoped>
.section-wrapper {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}

.section-wrapper.is-visible {
  opacity: 1;
  transform: translateY(0);
}
</style>