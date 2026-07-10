import { defineStore } from 'pinia'; import { ref } from 'vue'; import { automationApi } from '@/api/modules'; import type { AppAutomationTask } from '@/types';
export const useAutomationStore = defineStore('automation', () => {
  const list = ref<AppAutomationTask[]>([]); const loading = ref(false);
  async function loadList(): Promise<void> { loading.value = true; try { const res = await automationApi.list(); if (res.code === 0) list.value = res.data; } finally { loading.value = false; } }
  async function create(data: any): Promise<void> { await automationApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await automationApi.update(id, data); await loadList(); }
  async function trigger(id: number): Promise<string> { const res = await automationApi.trigger(id); return res.msg; }
  async function remove(id: number): Promise<void> { await automationApi.delete(id); await loadList(); }
  return { list, loading, loadList, create, update, trigger, remove };
});
