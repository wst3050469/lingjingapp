<template>
  <GlowButton @click="handleExport">
    <template #icon><DownloadOutlined /></template>
    导出
  </GlowButton>
</template>

<script setup lang="ts">
import { DownloadOutlined } from '@ant-design/icons-vue';
import GlowButton from '@/components/neon/GlowButton.vue';
import { downloadJSON, downloadCSV } from '@/utils/download';

const props = defineProps<{
  type: 'json' | 'csv';
  data: any;
  filename: string;
}>();

function handleExport() {
  if (props.type === 'json') {
    downloadJSON(props.data, props.filename);
  } else {
    downloadCSV(props.data, props.filename);
  }
}
</script>