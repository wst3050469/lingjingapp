<template>
  <a-drawer v-model:open="visible" :title="title" :width="width" @close="handleClose">
    <slot />
  </a-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue';

withDefaults(defineProps<{ title?: string; width?: number }>(), { title: '详情', width: 600 });

const visible = ref(false);

function open() { visible.value = true; }
function close() { visible.value = false; }
function handleClose() { close(); }

defineExpose({ open, close });
</script>