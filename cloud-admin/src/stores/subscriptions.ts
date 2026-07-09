import { defineStore } from 'pinia';
import { ref } from 'vue';
import { subscriptionApi } from '@/api/modules';
import type { Subscription } from '@/types';

export const useSubscriptionStore = defineStore('subscriptions', () => {
  const subscriptions = ref<Subscription[]>([]);
  const loading = ref(false);

  async function fetchSubscriptions(): Promise<void> {
    loading.value = true;
    try {
      subscriptions.value = await subscriptionApi.list();
    } finally {
      loading.value = false;
    }
  }

  return { subscriptions, loading, fetchSubscriptions };
});