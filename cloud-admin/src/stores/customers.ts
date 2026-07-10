import { defineStore } from 'pinia'; import { ref } from 'vue'; import { customerApi } from '@/api/modules'; import type { AppCustomer } from '@/types';
export const useCustomerStore = defineStore('customers', () => {
  const list = ref<AppCustomer[]>([]); const loading = ref(false);
  async function loadList(params?: Record<string, any>): Promise<void> { loading.value = true; try { const res = await customerApi.list(params); if (res.code === 0) list.value = res.data; } catch (e) { console.error("加载customers失败:", e); } finally { loading.value = false; } }
  async function create(data: any): Promise<void> { await customerApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await customerApi.update(id, data); await loadList(); }
  async function remove(id: number): Promise<void> { await customerApi.delete(id); await loadList(); }
  return { list, loading, loadList, create, update, remove };
});
