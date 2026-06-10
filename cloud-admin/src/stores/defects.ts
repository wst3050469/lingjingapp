import { defineStore } from 'pinia';
import { ref } from 'vue';
import { defectApi } from '@/api/modules';
import type { Defect } from '@/types';

export const useDefectStore = defineStore('defects', () => {
  const defects = ref<Defect[]>([]);
  const loading = ref(false);

  async function fetchDefects(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await defectApi.list(params);
      defects.value = Array.isArray(res) ? res : (res as any).data ?? [];
    } finally {
      loading.value = false;
    }
  }

  async function fixDefect(id: string): Promise<void> {
    await defectApi.fix(id);
    await fetchDefects();
  }

  async function verifyDefect(id: string): Promise<void> {
    await defectApi.verify(id);
    await fetchDefects();
  }

  return { defects, loading, fetchDefects, fixDefect, verifyDefect };
});