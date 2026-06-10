<template>
  <div>
    <SearchFilter :show-search="false">
      <template #filters>
        <a-range-picker v-model:value="dateRange" @change="fetchData" />
      </template>
    </SearchFilter>
    <DataTable :columns="columns" :data-source="store.sessions" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.pageSize" @page-change="handlePageChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <a-button type="link" size="small" @click="viewDetail(record)">详情</a-button>
          <a-button type="link" size="small" danger @click="handleDelete(record)">终止</a-button>
        </template>
      </template>
    </DataTable>
    <DetailDrawer ref="drawerRef" title="会话详情" />
    <ConfirmModal ref="confirmRef" danger title="终止会话" content="确定要终止此会话吗？" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSessionStore } from '@/stores/sessions';
import SearchFilter from '@/components/common/SearchFilter.vue';
import DataTable from '@/components/common/DataTable.vue';
import DetailDrawer from '@/components/common/DetailDrawer.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import type { Session } from '@/types';

const store = useSessionStore();
const drawerRef = ref();
const confirmRef = ref();
const dateRange = ref();

const columns = [
  { title: 'ID', dataIndex: 'session_id', key: 'id', width: 120 },
  { title: '标题', dataIndex: 'task_title', key: 'title', width: 200 },
  { title: '轮次', dataIndex: 'turn_count', key: 'turns', width: 80 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated', width: 180 },
  { title: '操作', key: 'actions', width: 150 },
];

function fetchData() { store.fetchSessions(); }
function handlePageChange(page: number, pageSize: number) { store.page = page; store.pageSize = pageSize; fetchData(); }
function viewDetail(record: Session) { drawerRef.value?.open(); }
async function handleDelete(record: Session) { try { await confirmRef.value?.show(); await store.deleteSession(record.session_id); } catch {} }

onMounted(fetchData);
</script>