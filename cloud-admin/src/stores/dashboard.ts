import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dashboardApi } from '@/api/modules';
import type { AppDashboardStats } from '@/types';

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<AppDashboardStats | null>(null);
  const loading = ref(false);

  async function loadStats(): Promise<void> {
    loading.value = true;
    try {
      const res = await dashboardApi.stats();
      if (res.code === 0) {
        stats.value = res.data;
      }
    } catch (e) { console.error("加载dashboard失败:", e); } finally {
      loading.value = false;
    }
  }

  return { stats, loading, loadStats };
});
