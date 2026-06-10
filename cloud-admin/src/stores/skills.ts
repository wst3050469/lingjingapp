import { defineStore } from 'pinia';
import { ref } from 'vue';
import { skillApi } from '@/api/modules';
import type { Skill } from '@/types';

export const useSkillStore = defineStore('skills', () => {
  const skills = ref<Skill[]>([]);
  const loading = ref(false);
  const statusFilter = ref<string>('');

  async function fetchSkills(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await skillApi.list({ status: statusFilter.value || undefined, ...params });
      skills.value = Array.isArray(res) ? res : (res as any).data ?? [];
    } finally {
      loading.value = false;
    }
  }

  async function approveSkill(id: string): Promise<void> {
    await skillApi.approve(id);
    await fetchSkills();
  }

  async function rejectSkill(id: string): Promise<void> {
    await skillApi.reject(id);
    await fetchSkills();
  }

  return { skills, loading, statusFilter, fetchSkills, approveSkill, rejectSkill };
});