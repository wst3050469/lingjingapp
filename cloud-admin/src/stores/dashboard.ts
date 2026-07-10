import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dashboardApi, wsApi } from '@/api/modules';
import type { AppDashboardStats } from '@/types';

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<AppDashboardStats | null>(null);
  const loading = ref(false);
  const wsOnline = ref(0);
  const wsDevices = ref(0);

  async function loadStats(): Promise<void> {
    loading.value = true;
    try {
      const res = await dashboardApi.stats();
      if (res.code === 0) {
        stats.value = res.data;
      }
    } catch (e) { console.error("加载仪表盘失败:", e); } finally {
      loading.value = false;
    }
  }

  async function loadWsOnline(): Promise<void> {
    try {
      const res = await wsApi.online();
      if (res.code === 0) {
        wsOnline.value = res.online_count ?? 0;
        wsDevices.value = res.total_devices ?? 0;
      }
    } catch (e) { console.error("加载WebSocket状态失败:", e); }
  }

  return { stats, loading, wsOnline, wsDevices, loadStats, loadWsOnline };
});
