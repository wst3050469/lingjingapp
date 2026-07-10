import { defineStore } from 'pinia'; import { ref } from 'vue'; import { chatApi } from '@/api/modules'; import type { AppChatSession } from '@/types';

export const useSessionStore = defineStore('sessions', () => {
  const list = ref<AppChatSession[]>([]);
  const loading = ref(false);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(20);

  async function loadList(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const p = { page: currentPage.value, page_size: pageSize.value, ...(params || {}) };
      const res = await chatApi.sessions(p);
      if (res.code === 0) {
        list.value = res.data;
        total.value = res.total || 0;
      }
    } finally { loading.value = false; }
  }

  async function search(keyword: string): Promise<void> {
    currentPage.value = 1;
    await loadList(keyword ? { keyword } : undefined);
  }

  function setPage(page: number) {
    currentPage.value = page;
    loadList();
  }

  function setPageSize(size: number) {
    pageSize.value = size;
    currentPage.value = 1;
    loadList();
  }

  return { list, loading, total, currentPage, pageSize, loadList, search, setPage, setPageSize };
});