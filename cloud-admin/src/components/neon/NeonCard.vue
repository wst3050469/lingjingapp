<template>
  <a-card v-bind="$attrs" class="neon-card" :class="{ 'neon-card-hoverable': hoverable }">
    <slot />
  </a-card>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ hoverable?: boolean }>(), { hoverable: true });
</script>

<style scoped>
.neon-card {
  border: var(--border-neon);
  transition: all 0.3s ease;
}
.neon-card-hoverable:hover {
  box-shadow: 0 0 25px rgba(0, 245, 255, 0.15), 0 0 50px rgba(77, 124, 255, 0.08);
  border-color: rgba(0, 245, 255, 0.4);
}
</style>