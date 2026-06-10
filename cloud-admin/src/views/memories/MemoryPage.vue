<template>
  <div>
    <SearchFilter @search="handleSearch">
      <template #filters>
        <a-select v-model:value="scopeFilter" placeholder="Scope" allow-clear style="width: 120px" @change="fetchData">
          <a-select-option value="global">全局</a-select-option>
          <a-select-option value="user">用户</a-select-option>
          <a-select-option value="session">会话</a-select-option>
        </a-select>
        <a-select v-model:value="categoryFilter" placeholder="分类" allow-clear style="width: 120px" @change="fetchData">
          <a-select-option value="fact">事实</a-select-option>
          <a-select-option value="preference">偏好</a-select-option>
          <a-select-option value="procedure">过程</a-select-option>
        </a-select>
      </template>
    </SearchFilter>
    <DataTable :columns="columns" :data-source="store.memories" :loading="store.loading" :total="store.total" :page="store.page" :page-size="store.pageSize" selectable @page-change="handlePageChange" @select="handleSelect">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <a-button type="link" size="small" @click="viewDetail(record)">详情</a-button>
          <a-button type="link" size="small" danger @click="handleDelete(record)">删除</a-button>
        </template>
      </template>
    </DataTable>
    <DetailDrawer ref="drawerRef" title="记忆详情" />
    <ConfirmModal ref="confirmRef" danger title="删除记忆" content="确定要删除此记忆吗？" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMemoryStore } from '@/stores/memories';
import SearchFilter from '@/components/common/SearchFilter.vue';
import DataTable from '@/components/common/DataTable.vue';
import DetailDrawer from '@/components/common/DetailDrawer.vue';
import ConfirmModal from '@/components/common/ConfirmModal.vue';
import type { Memory } from '@/types';

const store = useMemoryStore();
const drawerRef = ref();
const confirmRef = ref();
const scopeFilter = ref<string>();
const categoryFilter = ref<string>();

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 120 },
  { title: 'Scope', dataIndex: 'scope', key: 'scope', width: 80 },
  { title: '分类', dataIndex: 'category', key: 'category', width: 100 },
  { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated', width: 180 },
  { title: '操作', key: 'actions', width: 150 },
];

function fetchData() { store.fetchMemories({ scope: scopeFilter.value, category: categoryFilter.value }); }
function handleSearch(keyword: string) { store.fetchMemories({ search: keyword }); }
function handlePageChange(page: number, pageSize: number) { store.page = page; store.pageSize = pageSize; fetchData(); }
function handleSelect(keys: string[]) { /* batch selection */ }
function viewDetail(record: Memory) { drawerRef.value?.open(); }
async function handleDelete(record: Memory) { try { await confirmRef.value?.show(); await store.deleteMemory(record.id); } catch {} }

onMounted(fetchData);
</script>