<template>
  <div>
    <SearchFilter @search="handleSearch">
      <template #filters>
        <a-select v-model:value="severityFilter" placeholder="严重程度" allow-clear style="width: 120px" @change="fetchData">
          <a-select-option value="critical">Critical</a-select-option>
          <a-select-option value="high">High</a-select-option>
          <a-select-option value="medium">Medium</a-select-option>
          <a-select-option value="low">Low</a-select-option>
        </a-select>
        <a-select v-model:value="statusFilter" placeholder="状态" allow-clear style="width: 120px" @change="fetchData">
          <a-select-option value="open">Open</a-select-option>
          <a-select-option value="fixed">Fixed</a-select-option>
          <a-select-option value="verified">Verified</a-select-option>
          <a-select-option value="ignored">Ignored</a-select-option>
        </a-select>
      </template>
    </SearchFilter>
    <DataTable :columns="columns" :data-source="store.defects" :loading="store.loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'severity'">
          <NeonTag :color="severityColor(record.severity)">{{ record.severity }}</NeonTag>
        </template>
        <template v-if="column.key === 'status'">
          <NeonTag :color="statusColor(record.status)">{{ record.status }}</NeonTag>
        </template>
        <template v-if="column.key === 'actions'">
          <a-button v-if="record.status === 'open'" type="link" size="small" @click="store.fixDefect(record.id)">标记修复</a-button>
          <a-button v-if="record.status === 'fixed'" type="link" size="small" @click="store.verifyDefect(record.id)">验证</a-button>
          <a-button type="link" size="small" @click="viewDetail(record)">详情</a-button>
        </template>
      </template>
    </DataTable>
    <DetailDrawer ref="drawerRef" title="缺陷详情" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDefectStore } from '@/stores/defects';
import SearchFilter from '@/components/common/SearchFilter.vue';
import DataTable from '@/components/common/DataTable.vue';
import NeonTag from '@/components/neon/NeonTag.vue';
import DetailDrawer from '@/components/common/DetailDrawer.vue';
import type { Defect } from '@/types';

const store = useDefectStore();
const drawerRef = ref();
const severityFilter = ref<string>();
const statusFilter = ref<string>();

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
  { title: '严重程度', key: 'severity', width: 100 },
  { title: '状态', key: 'status', width: 100 },
  { title: '报告时间', dataIndex: 'created_at', key: 'time', width: 180 },
  { title: '操作', key: 'actions', width: 180 },
];

function severityColor(s: string) { return s === 'critical' ? 'red' : s === 'high' ? 'orange' : s === 'medium' ? 'blue' : 'cyan'; }
function statusColor(s: string) { return s === 'open' ? 'orange' : s === 'fixed' ? 'cyan' : s === 'verified' ? 'green' : 'purple'; }
function fetchData() { store.fetchDefects({ severity: severityFilter.value, status: statusFilter.value }); }
function handleSearch(keyword: string) { store.fetchDefects({ search: keyword }); }
function viewDetail(record: Defect) { drawerRef.value?.open(); }

onMounted(fetchData);
</script>