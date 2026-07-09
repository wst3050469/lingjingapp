import { defineStore } from 'pinia'; import { ref } from 'vue'; import { auditLogApi } from '@/api/modules'; import type { AppAuditLogEntry } from '@/types';
export const useLogStore = defineStore('logs', () => {
  const list = ref<AppAuditLogEntry[]>([]); const loading = ref(false);
  async function loadList(params?: Record<string, any>): Promise<void> {
    loading.value = true; try { const res = await auditLogApi.list(params); if (res.code === 0) list.value = res.data; } finally { loading.value = false; }
  }
  return { list, loading, loadList };
});
