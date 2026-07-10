import { defineStore } from 'pinia'; import { ref } from 'vue'; import { sampleApi } from '@/api/modules'; import type { AppSample } from '@/types';
export const useSampleStore = defineStore('samples', () => {
  const list = ref<AppSample[]>([]); const loading = ref(false);
  async function loadList(params?: Record<string, any>): Promise<void> { loading.value = true; try { const res = await sampleApi.list(params); if (res.code === 0) list.value = res.data; } catch (e) { console.error("加载samples失败:", e); } finally { loading.value = false; } }
  async function create(data: any): Promise<void> { await sampleApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await sampleApi.update(id, data); await loadList(); }
  async function remove(id: number): Promise<void> { await sampleApi.delete(id); await loadList(); }
  return { list, loading, loadList, create, update, remove };
});
