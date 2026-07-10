import { defineStore } from 'pinia';
import { ref } from 'vue';
import { contractApi } from '@/api/modules';
import type { AppContract } from '@/types';

export const useContractStore = defineStore('contracts', () => {
  const list = ref<AppContract[]>([]);
  const loading = ref(false);

  async function loadList(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try { const res = await contractApi.list(params); if (res.code === 0) list.value = res.data; }
    finally { loading.value = false; }
  }
  async function create(data: any): Promise<void> { await contractApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await contractApi.update(id, data); await loadList(); }
  async function remove(id: number): Promise<void> { await contractApi.delete(id); await loadList(); }

  return { list, loading, loadList, create, update, remove };
});
