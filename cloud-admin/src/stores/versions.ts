import { defineStore } from 'pinia';
import { ref } from 'vue';
import { versionApi } from '@/api/modules';
import type { Version } from '@/types';

export const useVersionStore = defineStore('versions', () => {
  const versions = ref<Version[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const statusFilter = ref('');

  async function fetchVersions(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await versionApi.list({ status: statusFilter.value || undefined, ...params });
      // Handle paginated response from new backend
      if (res && typeof res === 'object' && 'data' in res) {
        versions.value = (res as any).data ?? [];
        total.value = (res as any).pagination?.total ?? 0;
      } else if (Array.isArray(res)) {
        versions.value = res;
        total.value = res.length;
      }
    } finally {
      loading.value = false;
    }
  }

  async function createVersion(data: { version: string; changelog: string }): Promise<void> {
    await versionApi.create(data);
    await fetchVersions();
  }

  async function updateVersion(id: string, data: any): Promise<void> {
    await versionApi.update(id, data);
    await fetchVersions();
  }

  async function submitReview(version: string): Promise<void> {
    await versionApi.submit(version);
    await fetchVersions();
  }

  async function approveVersion(version: string, comment?: string): Promise<void> {
    await versionApi.approve(version, comment);
    await fetchVersions();
  }

  async function rejectVersion(version: string, reason: string): Promise<void> {
    await versionApi.reject(version, reason);
    await fetchVersions();
  }

  async function publishVersion(version: string): Promise<void> {
    await versionApi.publish(version);
    await fetchVersions();
  }

  return {
    versions, total, loading, statusFilter,
    fetchVersions, createVersion, updateVersion,
    submitReview, approveVersion, rejectVersion, publishVersion
  };
});