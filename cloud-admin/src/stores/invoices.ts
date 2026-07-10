import { defineStore } from 'pinia'; import { ref } from 'vue'; import { invoiceApi } from '@/api/modules'; import type { AppInvoice } from '@/types';
export const useInvoiceStore = defineStore('invoices', () => {
  const list = ref<AppInvoice[]>([]); const loading = ref(false);
  async function loadList(params?: Record<string, any>): Promise<void> { loading.value = true; try { const res = await invoiceApi.list(params); if (res.code === 0) list.value = res.data; } catch (e) { console.error("加载invoices失败:", e); } finally { loading.value = false; } }
  async function create(data: any): Promise<void> { await invoiceApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await invoiceApi.update(id, data); await loadList(); }
  async function remove(id: number): Promise<void> { await invoiceApi.delete(id); await loadList(); }
  return { list, loading, loadList, create, update, remove };
});
