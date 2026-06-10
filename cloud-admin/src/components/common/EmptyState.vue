<template>
  <div class="empty-state">
    <div class="empty-icon">
      <svg viewBox="0 0 64 41" width="128" height="82" xmlns="http://www.w3.org/2000/svg">
        <g fill="none" fill-rule="evenodd">
          <ellipse fill="var(--dark-600)" cx="32" cy="33" rx="32" ry="7" />
          <path d="M55 12.76L44.854 1.258C44.367.474 43.655 0 42.907 0H21.093c-.748 0-1.46.474-1.947 1.257L9 12.76V22h46V12.76z" fill="var(--dark-500)" />
          <path d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.802 53.68 35 52.05 35H11.95C10.32 35 9 33.803 9 32.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z" fill="var(--dark-400)" />
        </g>
      </svg>
    </div>
    <p class="empty-desc">{{ description }}</p>
    <a-button v-if="actionText" type="primary" @click="$emit('action')">{{ actionText }}</a-button>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ description?: string; actionText?: string }>(), { description: '暂无数据' });
defineEmits<{ (e: 'action'): void }>();
</script>

<style scoped>
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 0; }
.empty-icon { opacity: 0.6; margin-bottom: 16px; }
.empty-desc { color: var(--text-secondary); margin-bottom: 16px; }
</style>