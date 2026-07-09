<template>
  <div class="page">
    <h2 class="page-title">版本管理</h2>
    <a-table :dataSource="store.list" :columns="columns" rowKey="id" :loading="store.loading" size="small">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'status'">
          <a-tag :color="record.status === 'published' ? 'green' : record.status === 'pending_review' ? 'orange' : 'default'">{{ record.status }}</a-tag>
        </template>
        <template v-if="column.key === 'file_size'">{{ (record.file_size / 1024 / 1024).toFixed(1) }} MB</template>
        <template v-if="column.key === 'action'">
          <a-button size="small" v-if="record.status === 'pending_review'" @click="approve(record)">审核通过</a-button>
          <a-button size="small" v-if="record.status === 'pending_review'" @click="reject(record)" style="margin-left:4px">驳回</a-button>
          <a-button size="small" v-if="record.status === 'approved'" @click="store.publish(record.id)" style="margin-left:4px">发布</a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'; import { useVersionStore } from '@/stores/versions';
const store = useVersionStore();
const columns = [
  { title: '版本号', dataIndex: 'version', key: 'version' }, { title: '平台', dataIndex: 'platform', key: 'platform' },
  { title: '更新日志', dataIndex: 'changelog', key: 'changelog', ellipsis: true },
  { title: '文件大小', key: 'file_size' }, { title: '状态', key: 'status' },
  { title: '上传时间', dataIndex: 'created_at', key: 'created_at' }, { title: '操作', key: 'action', width: 200 },
];
onMounted(() => store.loadList());
async function approve(record: any) { try { await store.approve(record.id); } catch (e: any) { console.error(e); } }
async function reject(record: any) {
  const reason = prompt('请输入驳回原因：');
  if (reason) try { await store.reject(record.id, reason); } catch (e: any) { console.error(e); }
}
</script>
<style scoped>
.page { padding: 24px; } .page-title { color: var(--text-primary); margin-bottom: 16px; }
</style>
