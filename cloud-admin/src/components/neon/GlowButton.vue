<template>
  <a-button v-bind="$attrs" :class="['glow-btn', `glow-btn-${type}`]">
    <slot />
  </a-button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ type?: 'primary' | 'danger' | 'default' }>(), { type: 'primary' });
</script>

<style scoped>
.glow-btn-primary {
  background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));
  border: none;
  box-shadow: var(--neon-shadow-cyan);
  animation: glow-breathe 3s ease-in-out infinite;
}
.glow-btn-primary:hover {
  box-shadow: 0 0 30px rgba(0, 245, 255, 0.5), 0 0 80px rgba(0, 245, 255, 0.2);
}
.glow-btn-danger {
  box-shadow: 0 0 15px rgba(255, 77, 79, 0.3);
}
.glow-btn-danger:hover {
  box-shadow: 0 0 25px rgba(255, 77, 79, 0.5);
}
</style>