import { defineStore } from 'pinia';
import { ref } from 'vue';
import { tenantApi } from '@/api/modules';
import { message } from 'ant-design-vue';
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
    } catch (e) { console.error("加载租户失败:", e); } finally { loading.value = false; }
  }

  async function loadMembers(tenantId: string): Promise<void> {
    loading.value = true;
    try {
      const res = await tenantApi.members(tenantId);
      if (res.code === 0) members.value = res.data;
    } catch (e) { console.error("加载租户失败:", e); } finally { loading.value = false; }
  }

  async function loadDashboard(tenantId: string): Promise<void> {
    loading.value = true;
    try {
      const res = await tenantApi.dashboard(tenantId);
      if (res.code === 0) dashboardData.value = res.data;
    } catch (e) { console.error("加载租户失败:", e); } finally { loading.value = false; }
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

  // 模拟登录为租户管理员
  async function impersonate(tenantId: string): Promise<string | null> {
    try {
      const res = await tenantApi.impersonate(tenantId);
      if (res.code === 0 && res.data?.token) {
        message.success(`已模拟登录为租户「${res.data.tenant_name}」`);
        return res.data.token;
      }
      message.error('模拟登录失败：未获取到token');
      return null;
    } catch (e: any) {
      message.error('模拟登录失败：' + (e?.message || '网络错误'));
      return null;
    }
  }

  // 撤销模拟登录
  async function revokeImpersonation(): Promise<void> {
    try {
      await tenantApi.revokeImpersonation();
    } catch (e) { /* 静默处理 */ }
  }

  return { list, members, dashboardData, loading, loadList, loadMembers, loadDashboard, updateMember, removeMember, updateTenant, deleteTenant, impersonate, revokeImpersonation };
});
