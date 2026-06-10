import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiKeyApi } from '@/api/modules';
import type { ApiKey } from '@/types';

export const useApiKeyStore = defineStore('apiKeys', () => {
  const keys = ref<ApiKey[]>([]);
  const loading = ref(false);

  async function fetchKeys(): Promise<void> {
    loading.value = true;
    try {
      keys.value = await apiKeyApi.list();
    } finally {
      loading.value = false;
    }
  }

  async function createKey(data: any): Promise<any> {
    const res = await apiKeyApi.create(data);
    await fetchKeys();
    return res;
  }

  async function deleteKey(id: string): Promise<void> {
    await apiKeyApi.delete(id);
    await fetchKeys();
  }

  return { keys, loading, fetchKeys, createKey, deleteKey };
});