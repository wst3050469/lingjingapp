<template>
  <a-modal
    v-model:open="visible"
    :title="title"
    :ok-type="danger ? 'danger' : 'primary'"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <p>{{ content }}</p>
  </a-modal>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  title?: string;
  content?: string;
  danger?: boolean;
}>(), { title: '确认操作', content: '确定要执行此操作吗？', danger: false });

const visible = ref(false);
let resolveFn: (() => void) | null = null;
let rejectFn: ((err: Error) => void) | null = null;

function show(): Promise<void> {
  visible.value = true;
  return new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
}

function handleOk() {
  visible.value = false;
  resolveFn?.();
}

function handleCancel() {
  visible.value = false;
  rejectFn?.(new Error('cancelled'));
}

defineExpose({ show });
</script>