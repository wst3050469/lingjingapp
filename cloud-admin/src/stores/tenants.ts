import { defineStore } from 'pinia';
import { ref } from 'vue';
import { tenantApi } from '@/api/modules';
import type { AppTenant, AppTenantMember } from '@/types';

export const useTenantStore = defineStore('tenants', () => {
  const list = ref<AppTenant[]>([]);
  const members = ref<AppTenantMember[]>([]);
  const dashboardData = ref<any>(null);
  const loading = ref(false);

  async function loadList(): Promise<void> {
    loading.value = true;
    try {
      const res = await tenantApi.list();
      if (res.code === 0) list.value = res.data;
    } finally { loading.value = false; }
  }

  async function loadMembers(tenantId: string): Promise<void> {
    loading.value = true;
    try {
      const res = await tenantApi.members(tenantId);
      if (res.code === 0) members.value = res.data;
    } finally { loading.value = false; }
  }

  async function loadDashboard(tenantId: string): Promise<void> {
    loading.value = true;
    try {
      const res = await tenantApi.dashboard(tenantId);
      if (res.code === 0) dashboardData.value = res.data;
    } finally { loading.value = false; }
  }

  async function updateMember(tenantId: string, username: string, data: any): Promise<void> {
    await tenantApi.updateMember(tenantId, username, data);
    await loadMembers(tenantId);
  }

  async function removeMember(tenantId: string, username: string): Promise<void> {
    await tenantApi.removeMember(tenantId, username);
    await loadMembers(tenantId);
  }

  async function updateTenant(tenantId: string, data: any): Promise<void> {
    await tenantApi.update(tenantId, data);
    await loadList();
  }

  async function deleteTenant(tenantId: string): Promise<void> {
    await tenantApi.delete(tenantId);
    await loadList();
  }

  return { list, members, dashboardData, loading, loadList, loadMembers, loadDashboard, updateMember, removeMember, updateTenant, deleteTenant };
});
