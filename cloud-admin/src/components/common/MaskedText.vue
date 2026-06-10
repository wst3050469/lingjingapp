<template>
  <span class="masked-text" @click="toggle">
    <span class="masked-value">{{ revealed ? fullText : masked }}</span>
    <a-button type="link" size="small" class="toggle-btn">
      {{ revealed ? '隐藏' : '显示' }}
    </a-button>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { maskApiKey } from '@/utils/mask';

const props = defineProps<{ fullText: string }>();
const revealed = ref(false);

const masked = computed(() => maskApiKey(props.fullText));

function toggle() { revealed.value = !revealed.value; }
</script>

<style scoped>
.masked-text { display: inline-flex; align-items: center; gap: 4px; }
.toggle-btn { padding: 0; height: auto; font-size: 12px; }
</style>