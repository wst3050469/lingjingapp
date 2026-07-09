import { defineStore } from 'pinia';
import { ref } from 'vue';
import { scheduleApi } from '@/api/modules';
import type { Schedule } from '@/types';

export const useScheduleStore = defineStore('schedules', () => {
  const schedules = ref<Schedule[]>([]);
  const loading = ref(false);

  async function fetchSchedules(): Promise<void> {
    loading.value = true;
    try {
      schedules.value = await scheduleApi.list();
    } finally {
      loading.value = false;
    }
  }

  async function createSchedule(data: any): Promise<void> {
    await scheduleApi.create(data);
    await fetchSchedules();
  }

  async function updateSchedule(id: string, data: any): Promise<void> {
    await scheduleApi.update(id, data);
    await fetchSchedules();
  }

  async function deleteSchedule(id: string): Promise<void> {
    await scheduleApi.delete(id);
    await fetchSchedules();
  }

  return { schedules, loading, fetchSchedules, createSchedule, updateSchedule, deleteSchedule };
});