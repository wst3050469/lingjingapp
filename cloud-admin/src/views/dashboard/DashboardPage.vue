<template>
  <div class="dashboard">
    <!-- 统计卡片行 -->
    <a-row :gutter="16" class="stat-row">
      <a-col :xs="12" :sm="8" :lg="4" v-for="card in statCards" :key="card.key">
        <StatCard
          :title="card.title"
          :value="card.value"
          :icon="card.icon"
          :suffix="card.suffix"
          :trend="card.trend"
          clickable
          @click="router.push(card.route)"
        />
      </a-col>
    </a-row>

    <!-- 图表双栏 -->
    <a-row :gutter="16" class="chart-row">
      <a-col :span="24" :lg="14">
        <NeonCard title="活跃趋势（近7天）" class="chart-card">
          <TrendChart v-if="trendData.dates.length" :data="trendData" />
          <a-skeleton v-else active :paragraph="{ rows: 6 }" />
        </NeonCard>
      </a-col>
      <a-col :span="24" :lg="10">
        <NeonCard title="设备平台分布" class="chart-card">
          <PieChart v-if="platformData.length" :data="platformData" />
          <a-skeleton v-else active :paragraph="{ rows: 6 }" />
        </NeonCard>
      </a-col>
    </a-row>

    <!-- 最新审计日志 -->
    <NeonCard title="最新操作日志" class="log-card">
      <DataTable
        :columns="logColumns"
        :data-source="recentLogs"
        :loading="logsLoading"
        :show-pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'timestamp'">
            {{ formatDate(record.timestamp) }}
          </template>
        </template>
      </DataTable>
      <a-button type="link" style="margin-top: 12px" @click="router.push('/logs')">
        查看全部日志 →
      </a-button>
    </NeonCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, type Component } from 'vue';
import { useRouter } from 'vue-router';
import { get } from '@/api/index';
import { formatDate, formatNumber } from '@/utils/format';
import {
  DesktopOutlined,
  MessageOutlined,
  BellOutlined,
  AppstoreOutlined,
  BugOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons-vue';

import StatCard from '@/components/common/StatCard.vue';
import NeonCard from '@/components/neon/NeonCard.vue';
import TrendChart from '@/components/charts/TrendChart.vue';
import PieChart from '@/components/charts/PieChart.vue';
import DataTable from '@/components/common/DataTable.vue';

const router = useRouter();

// ========= Stats =========
interface StatItem {
  key: string;
  title: string;
  value: number;
  icon: Component;
  suffix: string;
  trend?: number;
  route: string;
}

const statCards = ref<StatItem[]>([
  { key: 'devices', title: '在线设备', value: 0, icon: DesktopOutlined, suffix: '台', route: '/devices' },
  { key: 'sessions', title: '活跃会话', value: 0, icon: MessageOutlined, suffix: '个', route: '/sessions' },
  { key: 'push', title: '今日推送', value: 0, icon: BellOutlined, suffix: '条', route: '/push' },
  { key: 'skills', title: '待审核技能', value: 0, icon: AppstoreOutlined, suffix: '个', route: '/skills' },
  { key: 'defects', title: '待处理缺陷', value: 0, icon: BugOutlined, suffix: '个', route: '/defects' },
  { key: 'version', title: '当前版本', value: 0, icon: CloudUploadOutlined, suffix: '', route: '/versions' },
]);

// ========= Trend Chart =========
const trendData = reactive<{ dates: string[]; series: { name: string; data: number[] }[] }>({
  dates: [],
  series: [],
});

// ========= Platform Pie =========
const platformData = ref<{ name: string; value: number }[]>([]);

// ========= Logs =========
const recentLogs = ref<any[]>([]);
const logsLoading = ref(false);

const logColumns = [
  { title: '操作', dataIndex: 'action', key: 'action', width: 240 },
  { title: '用户', dataIndex: 'user', key: 'user', width: 120 },
  { title: '时间', key: 'timestamp', width: 180 },
];

// ========= Fetch all =========
async function fetchDashboard() {
  try {
    // Parallel fetch: stats + trends + platforms + logs
    const [statsRes, trendRes, platRes, logRes] = await Promise.allSettled([
      get<any>('/stats'),
      get<any>('/stats/trends?days=7'),
      get<any>('/stats/platforms'),
      get<any>('/logs?limit=10'),
    ]);

    if (statsRes.status === 'fulfilled' && statsRes.value) {
      const s = statsRes.value;
      statCards.value[0].value = s.onlineDevices ?? 0;
      statCards.value[0].trend = s.devicesTrend;
      statCards.value[1].value = s.activeSessions ?? 0;
      statCards.value[1].trend = s.sessionsTrend;
      statCards.value[2].value = s.todayPush ?? 0;
      statCards.value[3].value = s.pendingSkills ?? 0;
      statCards.value[4].value = s.openDefects ?? 0;
      statCards.value[5].value = s.currentVersion ?? '—' as any;
      statCards.value[5].suffix = s.currentVersion ? `v${s.currentVersion}` : '';
    }

    if (trendRes.status === 'fulfilled' && trendRes.value) {
      trendData.dates = trendRes.value.dates ?? [];
      trendData.series = trendRes.value.series ?? [];
    }

    if (platRes.status === 'fulfilled' && platRes.value) {
      platformData.value = Array.isArray(platRes.value) ? platRes.value : [];
    }

    if (logRes.status === 'fulfilled' && logRes.value) {
      recentLogs.value = Array.isArray(logRes.value) ? logRes.value : [];
    }
  } catch {
    // dashboard gracefully degrades with empty states
  }
}

onMounted(fetchDashboard);
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

.stat-row {
  margin-bottom: 0;
}

.chart-row {
  margin-bottom: 0;
}

.chart-card {
  min-height: 340px;
}

.log-card {
  min-height: 200px;
}
</style>
