<template>
  <a-tag :color="colorMap[color]" :class="['neon-tag', `neon-tag-${color}`]">
    <slot />
  </a-tag>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ color?: 'cyan' | 'purple' | 'blue' | 'green' | 'orange' | 'red' }>(), { color: 'cyan' });

const colorMap: Record<string, string> = {
  cyan: 'cyan',
  purple: 'purple',
  blue: 'blue',
  green: 'green',
  orange: 'orange',
  red: 'red',
};
</script>

<style scoped>
.neon-tag-cyan { border-color: var(--neon-cyan); box-shadow: 0 0 8px rgba(0, 245, 255, 0.2); }
.neon-tag-purple { border-color: var(--neon-purple); box-shadow: 0 0 8px rgba(191, 0, 255, 0.2); }
.neon-tag-blue { border-color: var(--neon-blue); box-shadow: 0 0 8px rgba(77, 124, 255, 0.2); }
</style>