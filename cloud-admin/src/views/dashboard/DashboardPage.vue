<template>
  <div class="dashboard-page">
    <h2 class="page-title">平台概览</h2>
    <a-spin :spinning="dash.loading">
      <div class="stats-grid">
        <stat-card title="注册用户" :value="stats?.total_users ?? 0" icon="team" color="#1890ff" />
        <stat-card title="活跃用户" :value="stats?.active_users ?? 0" icon="user" color="#52c41a" />
        <stat-card title="企业租户" :value="stats?.total_tenants ?? 0" icon="building" color="#722ed1" />
        <stat-card title="活跃租户" :value="stats?.active_tenants ?? 0" icon="check-circle" color="#13c2c2" />
      </div>
    </a-spin>

    <a-card title="最近操作" class="activity-card">
      <a-table :dataSource="activities" :columns="columns" :pagination="{ pageSize: 10 }" size="small" rowKey="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'time'">{{ formatTime(record.created_at) }}</template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useDashboardStore } from '@/stores/dashboard';
import StatCard from '@/components/common/StatCard.vue';

const dash = useDashboardStore();
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const REFRESH_INTERVAL = 60000; // 60秒自动刷新

onMounted(async () => {
  await dash.loadStats();
  refreshTimer = setInterval(() => dash.loadStats(), REFRESH_INTERVAL);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});

const stats = computed(() => dash.stats);
const activities = computed(() => dash.stats?.recent_activities || []);

const columns = [
  { title: '操作人', dataIndex: 'admin_name', key: 'admin_name' },
  { title: '操作', dataIndex: 'action', key: 'action' },
  { title: '目标', dataIndex: 'target_type', key: 'target_type' },
  { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
  { title: '时间', key: 'time' },
];

function formatTime(t: string) {
  if (!t) return '';
  return new Date(t).toLocaleString('zh-CN');
}
</script>

<style scoped>
.dashboard-page { padding: 24px; }
.page-title { color: var(--text-primary); margin-bottom: 24px; font-size: 20px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
.activity-card { margin-top: 16px; }
</style>
