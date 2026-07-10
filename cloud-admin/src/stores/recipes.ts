import { defineStore } from 'pinia'; import { ref } from 'vue'; import { recipeApi } from '@/api/modules'; import type { AppRecipe } from '@/types';
export const useRecipeStore = defineStore('recipes', () => {
  const list = ref<AppRecipe[]>([]); const loading = ref(false);
  async function loadList(params?: Record<string, any>): Promise<void> { loading.value = true; try { const res = await recipeApi.list(params); if (res.code === 0) list.value = res.data; } catch (e) { console.error("加载recipes失败:", e); } finally { loading.value = false; } }
  async function create(data: any): Promise<void> { await recipeApi.create(data); await loadList(); }
  async function update(id: string, data: any): Promise<void> { await recipeApi.update(id, data); await loadList(); }
  async function remove(id: string): Promise<void> { await recipeApi.delete(id); await loadList(); }
  return { list, loading, loadList, create, update, remove };
});
