import { CloudManagementBaseService } from './base-service.js';
// @ts-ignore
import type { Subscription, Plan, CloudManagementError } from '@codepilot/core';

export interface SubscribeParams {
  planId: string;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly';
  paymentMethodId?: string;
}

export class SubscriptionService extends CloudManagementBaseService {
  async getSubscription(): Promise<Subscription> {
    console.log('[SubscriptionService] getSubscription');
    return this.request(() => this.client.get<Subscription>('/subscriptions/mine'));
  }

  async getPlans(): Promise<Plan[]> {
    console.log('[SubscriptionService] getPlans');
    return this.request(() => this.client.get<Plan[]>('/plans'));
  }

  async getPlan(planId: string): Promise<Plan> {
    console.log('[SubscriptionService] getPlan:', planId);
    return this.request(() => this.client.get<Plan>(`/plans/${planId}`));
  }

  async subscribe(params: SubscribeParams): Promise<Subscription> {
    console.log('[SubscriptionService] subscribe called with params:', JSON.stringify(params));
    return this.request(() => this.client.post<Subscription>('/subscriptions', params));
  }

  async upgradeSubscription(planId: string): Promise<Subscription> {
    return this.request(() => this.client.post<Subscription>('/subscriptions/upgrade', { planId }));
  }

  async downgradeSubscription(planId: string): Promise<Subscription> {
    return this.request(() => this.client.post<Subscription>('/subscriptions/downgrade', { planId }));
  }

  async cancelSubscription(reason?: string): Promise<Subscription> {
    return this.request(() => this.client.put<Subscription>('/subscriptions/mine/cancel', { reason }));
  }

  async renewSubscription(): Promise<Subscription> {
    return this.request(() => this.client.post<Subscription>('/subscriptions/renew'));
  }

  async enableAutoRenew(): Promise<Subscription> {
    return this.request(() => this.client.put<Subscription>('/subscriptions/mine', { autoRenew: true }));
  }

  async disableAutoRenew(): Promise<Subscription> {
    return this.request(() => this.client.put<Subscription>('/subscriptions/mine', { autoRenew: false }));
  }

  async getUsage(): Promise<Subscription['usage']> {
    return this.request(() => this.client.get('/subscriptions/usage'));
  }

  async comparePlans(): Promise<{ current: Plan; available: Plan[] }> {
    return this.request(() => this.client.get('/subscriptions/compare'));
  }

  // New methods for payment and invoice
  async getPayments(deviceId?: string): Promise<any[]> {
    const params: any = {};
    if (deviceId) params.deviceId = deviceId;
    console.log('[SubscriptionService] getPayments with deviceId:', deviceId || '(all)');
    return this.request(() => this.client.get('/payments', { params }));
  }

  async submitOfflinePayment(params: { amount: number; companyName: string; bankName?: string; bankAccount?: string; remark?: string; receiptUrl?: string }): Promise<any> {
    return this.request(() => this.client.post('/payments/offline', params));
  }

  async getInvoices(): Promise<any[]> {
    return this.request(() => this.client.get('/invoices'));
  }

  async createInvoice(params: { paymentId?: string; amount: number; companyName: string; taxId?: string; companyAddress?: string; companyPhone?: string; bankName?: string; bankAccount?: string; email?: string }): Promise<any> {
    return this.request(() => this.client.post('/invoices', params));
  }
}

export const subscriptionService = new SubscriptionService({
  baseUrl: 'https://www.spiritrealmz.com/api'
});
