import { defineStore } from 'pinia';
import { ref } from 'vue';
import { deviceApi } from '@/api/modules';
import type { Device } from '@/types';

export const useDeviceStore = defineStore('devices', () => {
  const devices = ref<Device[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const filters = ref<Record<string, any>>({});
  const page = ref(1);
  const pageSize = ref(20);

  async function fetchDevices(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      if (params) filters.value = params;
      const res = await deviceApi.list({ ...filters.value, page: page.value, limit: pageSize.value });
      devices.value = Array.isArray(res) ? res : (res as any).data ?? [];
      total.value = Array.isArray(res) ? res.length : (res as any).total ?? 0;
    } finally {
      loading.value = false;
    }
  }

  async function updateDevice(id: string, data: Partial<Device>): Promise<void> {
    await deviceApi.update(id, data);
    await fetchDevices();
  }

  async function deleteDevice(id: string): Promise<void> {
    await deviceApi.delete(id);
    await fetchDevices();
  }

  return { devices, total, loading, filters, page, pageSize, fetchDevices, updateDevice, deleteDevice };
});