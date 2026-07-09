import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supplierApi } from '@/api/modules';
import type { AppSupplier } from '@/types';

export const useSupplierStore = defineStore('suppliers', () => {
  const list = ref<AppSupplier[]>([]);
  const loading = ref(false);
  async function loadList(): Promise<void> {
    loading.value = true;
    try { const res = await supplierApi.list(); if (res.code === 0) list.value = res.data; }
    finally { loading.value = false; }
  }
  async function create(data: any): Promise<void> { await supplierApi.create(data); await loadList(); }
  async function update(id: number, data: any): Promise<void> { await supplierApi.update(id, data); await loadList(); }
  async function remove(id: number): Promise<void> { await supplierApi.delete(id); await loadList(); }
  return { list, loading, loadList, create, update, remove };
});
