<template>
  <div class="page">
    <h2 class="page-title">会话管理</h2>
    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'time'">{{ formatTime(record.created_at) }}</template>
      </template>
    </a-table>
  </div>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'; import { useSessionStore } from '@/stores/sessions';
const store = useSessionStore();
const columns = [
  { title: '会话ID', dataIndex: 'id', key: 'id' }, { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '用户', dataIndex: 'user_id', key: 'user_id' }, { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '创建时间', key: 'time' },
];
onMounted(() => store.loadList());
function formatTime(t: string) { if (!t) return ''; return new Date(t).toLocaleString('zh-CN'); }
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; }
</style>
