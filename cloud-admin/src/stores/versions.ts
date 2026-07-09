import { defineStore } from 'pinia'; import { ref } from 'vue'; import { versionApi } from '@/api/modules'; import type { AppVersion } from '@/types';
export const useVersionStore = defineStore('versions', () => {
  const list = ref<AppVersion[]>([]); const loading = ref(false);
  async function loadList(): Promise<void> { loading.value = true; try { const res = await versionApi.list(); if (res.code === 0) list.value = res.data; } finally { loading.value = false; } }
  async function publish(id: number): Promise<void> { await versionApi.publish(id); await loadList(); }
  async function archive(id: number): Promise<void> { await versionApi.archive(id); await loadList(); }
  async function approve(id: number): Promise<void> { await versionApi.approve(id); await loadList(); }
  async function reject(id: number, reason: string): Promise<void> { await versionApi.reject(id, reason); await loadList(); }
  return { list, loading, loadList, publish, archive, approve, reject };
});
