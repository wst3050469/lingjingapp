import { defineStore } from 'pinia';
import { ref } from 'vue';
import { paymentApi, invoiceApi } from '@/api/modules';
import type { Payment, Invoice } from '@/types';

export const usePaymentStore = defineStore('payments', () => {
  const payments = ref<Payment[]>([]);
  const invoices = ref<Invoice[]>([]);
  const loading = ref(false);

  async function fetchPayments(params?: Record<string, any>): Promise<void> {
    loading.value = true;
    try {
      payments.value = await paymentApi.list();
    } finally {
      loading.value = false;
    }
  }

  async function verifyPayment(id: string): Promise<void> {
    await paymentApi.verify(id);
    await fetchPayments();
  }

  async function fetchInvoices(): Promise<void> {
    loading.value = true;
    try {
      invoices.value = await invoiceApi.list();
    } finally {
      loading.value = false;
    }
  }

  async function updateInvoice(id: string, data: any): Promise<void> {
    await invoiceApi.update(id, data);
    await fetchInvoices();
  }

  return { payments, invoices, loading, fetchPayments, verifyPayment, fetchInvoices, updateInvoice };
});