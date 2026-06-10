import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authApi } from '@/api/modules';
import type { AdminUser } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('admin_token'));
  const user = ref<AdminUser | null>(null);
  const isDefaultPassword = ref(false);
  const loading = ref(false);

  async function login(username: string, password: string): Promise<void> {
    loading.value = true;
    try {
      const res = await authApi.login({ username, password });
      token.value = res.token;
      user.value = { username: res.username, role: 'admin' };
      localStorage.setItem('admin_token', res.token);
      const check = await authApi.checkDefaultPassword();
      isDefaultPassword.value = check.hasDefault;
    } finally {
      loading.value = false;
    }
  }

  function logout(): void {
    token.value = null;
    user.value = null;
    isDefaultPassword.value = false;
    localStorage.removeItem('admin_token');
  }

  async function checkDefault(): Promise<void> {
    const check = await authApi.checkDefaultPassword();
    isDefaultPassword.value = check.hasDefault;
  }

  async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await authApi.changePassword({ oldPassword, newPassword });
    isDefaultPassword.value = false;
  }

  return { token, user, isDefaultPassword, loading, login, logout, checkDefault, changePassword };
});