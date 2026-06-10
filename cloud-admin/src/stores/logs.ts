import { defineStore } from 'pinia';
import { ref } from 'vue';
import { logApi } from '@/api/modules';
import type { AuditLogEntry } from '@/types';

export const useLogStore = defineStore('logs', () => {
  const logs = ref<AuditLogEntry[]>([]);
  const loading = ref(false);
  const sseConnected = ref(false);
  const hasNewLogs = ref(false);

  async function fetchLogs(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await logApi.list(params);
      logs.value = Array.isArray(res) ? res : (res as any).data ?? [];
    } finally {
      loading.value = false;
    }
  }

  function prependLog(entry: AuditLogEntry): void {
    logs.value.unshift(entry);
    hasNewLogs.value = true;
  }

  function clearNewFlag(): void {
    hasNewLogs.value = false;
  }

  return { logs, loading, sseConnected, hasNewLogs, fetchLogs, prependLog, clearNewFlag };
});