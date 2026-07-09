import { defineStore } from 'pinia'; import { ref } from 'vue'; import { sampleApi } from '@/api/modules'; import type { AppSample } from '@/types';
export const useSampleStore = defineStore('samples', () => {
  const list = ref<AppSample[]>([]); const loading = ref(false);
  async function loadList(): Promise<void> { loading.value = true; try { const res = await sampleApi.list(); if (res.code === 0) list.value = res.data; } finally { loading.value = false; } }
  async function create(data: any): Promise<void> { await sampleApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await sampleApi.update(id, data); await loadList(); }
  async function remove(id: number): Promise<void> { await sampleApi.delete(id); await loadList(); }
  return { list, loading, loadList, create, update, remove };
});
