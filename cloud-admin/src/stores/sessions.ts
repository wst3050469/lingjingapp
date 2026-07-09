import { defineStore } from 'pinia'; import { ref } from 'vue'; import { chatApi } from '@/api/modules'; import type { AppChatSession } from '@/types';
export const useSessionStore = defineStore('sessions', () => {
  const list = ref<AppChatSession[]>([]); const loading = ref(false);
  async function loadList(): Promise<void> { loading.value = true; try { const res = await chatApi.sessions(); if (res.code === 0) list.value = res.data; } finally { loading.value = false; } }
  return { list, loading, loadList };
});
