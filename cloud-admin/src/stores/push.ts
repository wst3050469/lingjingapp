import { defineStore } from 'pinia';
import { ref } from 'vue';
import { pushApi } from '@/api/modules';
import type { PushNotification } from '@/types';

export const usePushStore = defineStore('push', () => {
  const notifications = ref<PushNotification[]>([]);
  const loading = ref(false);
  const sending = ref(false);

  async function fetchNotifications(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      const res = await pushApi.list(params);
      notifications.value = Array.isArray(res) ? res : (res as any).data ?? [];
    } finally {
      loading.value = false;
    }
  }

  async function sendNotification(data: any): Promise<void> {
    sending.value = true;
    try {
      await pushApi.send(data);
      await fetchNotifications();
    } finally {
      sending.value = false;
    }
  }

  return { notifications, loading, sending, fetchNotifications, sendNotification };
});