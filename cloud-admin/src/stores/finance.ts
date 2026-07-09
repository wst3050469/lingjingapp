import { defineStore } from 'pinia'; import { ref } from 'vue'; import { financeApi } from '@/api/modules'; import type { AppFinance } from '@/types';
export const useFinanceStore = defineStore('finance', () => {
  const list = ref<AppFinance[]>([]); const loading = ref(false);
  async function loadList(): Promise<void> { loading.value = true; try { const res = await financeApi.list(); if (res.code === 0) list.value = res.data; } finally { loading.value = false; } }
  async function create(data: any): Promise<void> { await financeApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await financeApi.update(id, data); await loadList(); }
  async function remove(id: number): Promise<void> { await financeApi.delete(id); await loadList(); }
  return { list, loading, loadList, create, update, remove };
});
