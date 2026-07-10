import { defineStore } from 'pinia'; import { ref } from 'vue'; import { financeApi } from '@/api/modules'; import type { AppFinance } from '@/types';

export const useFinanceStore = defineStore('finance', () => {
  const list = ref<AppFinance[]>([]);
  const loading = ref(false);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(20);

  async function loadList(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const p = { page: currentPage.value, page_size: pageSize.value, ...(params || {}) };
      const res = await financeApi.list(p);
      if (res.code === 0) {
        list.value = res.data;
        total.value = res.total || 0;
      }
    } finally { loading.value = false; }
  }

  async function create(data: any): Promise<void> { await financeApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await financeApi.update(id, data); await loadList(); }
  async function remove(id: number): Promise<void> { await financeApi.delete(id); await loadList(); }

  function setPage(page: number) { currentPage.value = page; loadList(); }
  function setPageSize(size: number) { pageSize.value = size; currentPage.value = 1; loadList(); }

  return { list, loading, total, currentPage, pageSize, loadList, create, update, remove, setPage, setPageSize };
});