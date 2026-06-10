import { defineStore } from 'pinia';
import { ref } from 'vue';
import { sessionApi } from '@/api/modules';
import type { Session } from '@/types';

export const useSessionStore = defineStore('sessions', () => {
  const sessions = ref<Session[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const page = ref(1);
  const pageSize = ref(20);

  async function fetchSessions(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await sessionApi.list({ page: page.value, limit: pageSize.value, ...params });
      sessions.value = Array.isArray(res) ? res : (res as any).data ?? [];
      total.value = Array.isArray(res) ? res.length : (res as any).total ?? 0;
    } finally {
      loading.value = false;
    }
  }

  async function deleteSession(id: string): Promise<void> {
    await sessionApi.delete(id);
    await fetchSessions();
  }

  return { sessions, total, loading, page, pageSize, fetchSessions, deleteSession };
});