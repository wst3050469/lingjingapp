<template>
  <div class="page">
    <h2 class="page-title">审计日志</h2>
    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small" :pagination="{ pageSize: 20 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'time'">{{ formatTime(record.created_at) }}</template>
      </template>
    </a-table>
  </div>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'; import { useLogStore } from '@/stores/logs';
const store = useLogStore();
const columns = [
  { title: '管理员', dataIndex: 'admin_name', key: 'admin_name' }, { title: '操作', dataIndex: 'action', key: 'action' },
  { title: '目标类型', dataIndex: 'target_type', key: 'target_type' }, { title: '目标ID', dataIndex: 'target_id', key: 'target_id' },
  { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true }, { title: '时间', key: 'time', width: 180 },
];
onMounted(() => store.loadList());
function formatTime(t: string) { if (!t) return ''; return new Date(t).toLocaleString('zh-CN'); }
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; }
</style>
