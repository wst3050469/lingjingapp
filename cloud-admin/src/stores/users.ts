import { defineStore } from 'pinia';
import { ref } from 'vue';
import { userApi, inviteCodeApi } from '@/api/modules';
import type { AppUser, AppInviteCode, AppTeamInviteCode } from '@/types';

export const useUserStore = defineStore('users', () => {
  const registeredUsers = ref<AppUser[]>([]);
  const inviteCodes = ref<AppInviteCode[]>([]);
  const teamInviteCodes = ref<AppTeamInviteCode[]>([]);
  const loading = ref(false);

  async function loadRegistered(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await userApi.listRegistered(params);
      if (res.code === 0) registeredUsers.value = res.data;
    } catch (e) { console.error("加载用户失败:", e); } finally { loading.value = false; }
  }

  async function loadInviteCodes(): Promise<void> {
    loading.value = true;
    try {
      const res = await userApi.listInviteUsers();
      if (res.code === 0) inviteCodes.value = res.data;
    } catch (e) { console.error("加载用户失败:", e); } finally { loading.value = false; }
  }

  async function loadTeamInviteCodes(): Promise<void> {
    loading.value = true;
    try {
      const res = await inviteCodeApi.listTeamCodes();
      if (res.code === 0) teamInviteCodes.value = res.data;
    } catch (e) { console.error("加载用户失败:", e); } finally { loading.value = false; }
  }

  async function toggleUser(userType: string, userId: string): Promise<void> {
    await userApi.toggleUser(userType, userId);
  }

  async function createInviteCode(data: any): Promise<void> {
    await inviteCodeApi.create(data);
    await loadInviteCodes();
  }

  async function deleteInviteCode(id: number): Promise<void> {
    await inviteCodeApi.delete(id);
    await loadInviteCodes();
  }

  async function createTeamInviteCode(data: any): Promise<void> {
    await inviteCodeApi.createTeamCode(data);
    await loadTeamInviteCodes();
  }

  async function revokeTeamCode(code: string): Promise<void> {
    await inviteCodeApi.revokeTeamCode(code);
    await loadTeamInviteCodes();
  }

  return {
    registeredUsers, inviteCodes, teamInviteCodes, loading,
    loadRegistered, loadInviteCodes, loadTeamInviteCodes,
    toggleUser, createInviteCode, deleteInviteCode,
    createTeamInviteCode, revokeTeamCode,
  };
});
