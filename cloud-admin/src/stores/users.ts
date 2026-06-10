import { defineStore } from 'pinia';
import { ref } from 'vue';
import { get, post, put, del } from '@/api/index';

interface User { id: string; username: string; email: string; role: string; status: string; created_at: string; }

export const useUserStore = defineStore('users', () => {
  const users = ref<User[]>([]);
  const loading = ref(false);

  async function fetchUsers(): Promise<void> {
    loading.value = true;
    try {
      users.value = await get<User[]>('/users');
    } finally {
      loading.value = false;
    }
  }

  async function createUser(data: any): Promise<void> {
    await post('/users', data);
    await fetchUsers();
  }

  async function updateUser(id: string, data: any): Promise<void> {
    await put(`/users/${id}`, data);
    await fetchUsers();
  }

  async function deleteUser(id: string): Promise<void> {
    await del(`/users/${id}`);
    await fetchUsers();
  }

  return { users, loading, fetchUsers, createUser, updateUser, deleteUser };
});