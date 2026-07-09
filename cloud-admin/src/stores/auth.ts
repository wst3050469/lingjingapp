import { defineStore } from 'pinia';
import { ref } from 'vue';
import { authApi } from '@/api/modules';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('app_admin_token'));
  const user = ref<{ username: string; nickname: string; role: string } | null>(null);
  const loading = ref(false);

  async function login(username: string, password: string): Promise<void> {
    loading.value = true;
    try {
      const res = await authApi.login({ username, password });
      token.value = res.token;
      user.value = { username, nickname: res.nickname, role: res.role };
      localStorage.setItem('app_admin_token', res.token);
    } finally {
      loading.value = false;
    }
  }

  function logout(): void {
    token.value = null;
    user.value = null;
    localStorage.removeItem('app_admin_token');
  }

  async function checkSession(): Promise<boolean> {
    if (!token.value) return false;
    try {
      const res = await authApi.checkSession();
      if (res.code === 0) {
        user.value = { username: res.nickname, nickname: res.nickname, role: res.role };
        return true;
      }
      return false;
    } catch {
      logout();
      return false;
    }
  }

  return { token, user, loading, login, logout, checkSession };
});
