import { defineStore } from 'pinia'; import { ref } from 'vue'; import { auditLogApi } from '@/api/modules'; import type { AppAuditLogEntry } from '@/types';

export const useLogStore = defineStore('logs', () => {
  const list = ref<AppAuditLogEntry[]>([]);
  const loading = ref(false);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(20);

  async function loadList(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await auditLogApi.list(params);
      if (res.code === 0) {
        list.value = res.data;
        total.value = res.total || 0;
      }
    } catch (e) { console.error("加载logs失败:", e); } finally { loading.value = false; }
  }

  function setPage(page: number) { currentPage.value = page; }
  function setPageSize(size: number) { pageSize.value = size; currentPage.value = 1; }

  return { list, loading, total, currentPage, pageSize, loadList, setPage, setPageSize };
});