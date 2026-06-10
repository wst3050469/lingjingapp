import { defineStore } from 'pinia';
import { ref } from 'vue';
import { memoryApi } from '@/api/modules';
import type { Memory } from '@/types';

export const useMemoryStore = defineStore('memories', () => {
  const memories = ref<Memory[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const page = ref(1);
  const pageSize = ref(20);

  async function fetchMemories(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await memoryApi.list({ page: page.value, limit: pageSize.value, ...params });
      memories.value = Array.isArray(res) ? res : (res as any).data ?? [];
      total.value = Array.isArray(res) ? res.length : (res as any).total ?? 0;
    } finally {
      loading.value = false;
    }
  }

  async function deleteMemory(id: string): Promise<void> {
    await memoryApi.delete(id);
    await fetchMemories();
  }

  return { memories, total, loading, page, pageSize, fetchMemories, deleteMemory };
});