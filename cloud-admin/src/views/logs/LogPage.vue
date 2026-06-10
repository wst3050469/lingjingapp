<template>
  <div>
    <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
      <!-- Tab 1: 实时日志 (SSE) -->
      <a-tab-pane key="realtime" tab="实时日志">
        <SearchFilter :show-search="false">
          <template #filters>
            <a-select v-model:value="typeFilter" placeholder="日志类型" allow-clear style="width: 140px" @change="fetchData">
              <a-select-option value="webhook">Webhook</a-select-option>
              <a-select-option value="session">Session</a-select-option>
              <a-select-option value="admin_action">Admin</a-select-option>
              <a-select-option value="skill_audit">Skill Audit</a-select-option>
            </a-select>
            <a-range-picker v-model:value="dateRange" @change="fetchData" />
          </template>
        </SearchFilter>
        <div class="sse-status" v-if="sseConnected">
          <NeonTag color="green">SSE 已连接</NeonTag>
        </div>
        <div class="sse-status" v-else>
          <NeonTag color="orange">SSE 未连接</NeonTag>
        </div>
        <DataTable :columns="sseColumns" :data-source="logStore.logs" :loading="logStore.loading">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'timestamp'">{{ formatDate(record.timestamp) }}</template>
          </template>
        </DataTable>
        <ExportButton style="margin-top: 16px" type="csv" :data="logStore.logs" filename="audit-logs.csv" />
      </a-tab-pane>

      <!-- Tab 2: 审计记录 (DB) -->
      <a-tab-pane key="audit" tab="审计记录">
        <SearchFilter :show-search="true" @search="onAuditSearch">
          <template #filters>
            <a-input v-model:value="auditUserFilter" placeholder="用户" allow-clear style="width: 140px" @pressEnter="fetchAudit" />
            <a-select v-model:value="auditMethodFilter" placeholder="方法" allow-clear style="width: 100px" @change="fetchAudit">
              <a-select-option value="GET">GET</a-select-option>
              <a-select-option value="POST">POST</a-select-option>
              <a-select-option value="PUT">PUT</a-select-option>
              <a-select-option value="DELETE">DELETE</a-select-option>
            </a-select>
            <a-input v-model:value="auditPathFilter" placeholder="路径" allow-clear style="width: 200px" @pressEnter="fetchAudit" />
          </template>
        </SearchFilter>
        <DataTable :columns="auditColumns" :data-source="auditStore.records" :loading="auditStore.loading">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status_code'">
              <a-tag :color="statusColor(record.status_code)">{{ record.status_code }}</a-tag>
            </template>
            <template v-if="column.key === 'method'">
              <a-tag :color="methodColor(record.method)">{{ record.method }}</a-tag>
            </template>
            <template v-if="column.key === 'created_at'">{{ formatDate(record.created_at) }}</template>
            <template v-if="column.key === 'duration'">{{ record.duration_ms }}ms</template>
          </template>
        </DataTable>
        <div class="audit-pagination" v-if="auditStore.pagination.total > 0">
          <a-pagination
            v-model:current="auditPage"
            :total="auditStore.pagination.total"
            :page-size="auditStore.pagination.pageSize"
            :show-total="(total: number) => `共 ${total} 条`"
            @change="onAuditPageChange"
          />
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useLogStore } from '@/stores/logs';
import { useAuditStore } from '@/stores/audit';
import { useSSE } from '@/composables/useSSE';
import { formatDate } from '@/utils/format';
import SearchFilter from '@/components/common/SearchFilter.vue';
import DataTable from '@/components/common/DataTable.vue';
import NeonTag from '@/components/neon/NeonTag.vue';
import ExportButton from '@/components/common/ExportButton.vue';

const logStore = useLogStore();
const auditStore = useAuditStore();

// --- Tab state ---
const activeTab = ref('realtime');

// --- SSE / Realtime ---
const typeFilter = ref<string>();
const dateRange = ref();
const sseConnected = ref(false);

const token = localStorage.getItem('admin_token') ?? '';
const { connected, connect, disconnect } = useSSE({
  url: '/admin/api/logs/stream',
  token,
  onMessage: (data) => { logStore.prependLog(data); },
  pollingFallback: { url: '/admin/api/logs', interval: 30000 },
});

const sseColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '操作', dataIndex: 'action', key: 'action', width: 200 },
  { title: '用户', dataIndex: 'user', key: 'user', width: 120 },
  { title: '目标', dataIndex: 'target', key: 'target', width: 150 },
  { title: '时间', key: 'timestamp', width: 180 },
];

function fetchData() { logStore.fetchLogs({ type: typeFilter.value }); }

// --- Audit ---
const auditUserFilter = ref('');
const auditMethodFilter = ref<string>();
const auditPathFilter = ref('');
const auditPage = ref(1);

const auditColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
  { title: '用户', dataIndex: 'user', key: 'user', width: 100, ellipsis: true },
  { title: 'IP', dataIndex: 'ip', key: 'ip', width: 130 },
  { title: '方法', key: 'method', width: 70 },
  { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
  { title: '状态', key: 'status_code', width: 70 },
  { title: '耗时', key: 'duration', width: 70 },
  { title: '时间', key: 'created_at', width: 180 },
];

function fetchAudit() {
  auditStore.fetchRecords({
    page: auditPage.value,
    pageSize: 20,
    user: auditUserFilter.value || undefined,
    method: auditMethodFilter.value || undefined,
    path: auditPathFilter.value || undefined,
  });
}

function onAuditSearch(query: string) {
  auditPathFilter.value = query;
  auditPage.value = 1;
  fetchAudit();
}

function onAuditPageChange(page: number) {
  auditPage.value = page;
  fetchAudit();
}

function onTabChange(key: string) {
  if (key === 'audit') {
    fetchAudit();
  } else {
    fetchData();
  }
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'green';
  if (code >= 400 && code < 500) return 'orange';
  if (code >= 500) return 'red';
  return 'default';
}

function methodColor(method: string): string {
  const map: Record<string, string> = { GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red' };
  return map[method] || 'default';
}

onMounted(() => {
  fetchData();
  sseConnected.value = false;
  connect();
  // Watch SSE connection status
  const timer = setInterval(() => { sseConnected.value = connected.value; }, 1000);
  onUnmounted(() => clearInterval(timer));
});
onUnmounted(() => { disconnect(); });
</script>

<style scoped>
.sse-status { margin-bottom: 12px; }
.audit-pagination { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
