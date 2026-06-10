import { defineStore } from 'pinia';
import { ref } from 'vue';
import { auditLogApi } from '@/api/modules';
import type { AuditLogRecord } from '@/types';

export const useAuditStore = defineStore('audit', () => {
  const records = ref<AuditLogRecord[]>([]);
  const loading = ref(false);
  const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 0 });

  async function fetchRecords(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await auditLogApi.list(params);
      records.value = res.data ?? [];
      pagination.value = res.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 0 };
    } catch {
      records.value = [];
    } finally {
      loading.value = false;
    }
  }

  return { records, loading, pagination, fetchRecords };
});
