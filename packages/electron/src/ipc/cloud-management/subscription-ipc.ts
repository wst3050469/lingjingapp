import { ipcMain } from 'electron';
import { subscriptionService } from '../../services/cloud-management/subscription-service.js';
import type { SubscribeParams } from '../../services/cloud-management/subscription-service.js';
import { generateDeviceFingerprint } from '../../services/secure-storage.js';

/**
 * Wrap IPC handler with error serialization.
 * IMPORTANT: ipcMain.handle passes (event, ...args) to the handler.
 * The _event parameter must be present to correctly receive user arguments.
 */
function wrapHandler<T>(fn: () => Promise<T>): (_event: any) => Promise<T> {
  return async (_event: any) => {
    try {
      return await fn();
    } catch (err: any) {
      throw new Error(err?.message || String(err) || 'Unknown error');
    }
  };
}

function wrapHandlerWithArg<T, A>(fn: (arg: A) => Promise<T>): (_event: any, arg: A) => Promise<T> {
  return async (_event: any, arg: A) => {
    try {
      return await fn(arg);
    } catch (err: any) {
      throw new Error(err?.message || String(err) || 'Unknown error');
    }
  };
}

export function registerSubscriptionIpc(): void {
  ipcMain.handle('cloud:subscription:get', wrapHandler(() => subscriptionService.getSubscription()));
  
  ipcMain.handle('cloud:subscription:getPlans', wrapHandler(() => subscriptionService.getPlans()));
  
  ipcMain.handle('cloud:subscription:getPlan', wrapHandlerWithArg((planId: string) => subscriptionService.getPlan(planId)));
  
  ipcMain.handle('cloud:subscription:subscribe', wrapHandlerWithArg(async (params: SubscribeParams) => {
    console.log('[SubscriptionIPC] subscribe called with params:', JSON.stringify(params), 'planId:', params?.planId);
    if (!params?.planId) {
      throw new Error('订阅请求缺少套餐ID(planId)，请选择一个套餐后重试');
    }
    const deviceId = generateDeviceFingerprint().fingerprint;
    console.log('[SubscriptionIPC] executing subscribe: planId=' + params.planId + ' deviceId=' + deviceId);
    const result = await subscriptionService.subscribe({ ...params, deviceId } as SubscribeParams & { deviceId: string });
    console.log('[SubscriptionIPC] subscribe result:', JSON.stringify(result));
    return result;
  }));
  
  ipcMain.handle('cloud:subscription:upgrade', wrapHandlerWithArg((planId: string) => subscriptionService.upgradeSubscription(planId)));
  
  ipcMain.handle('cloud:subscription:downgrade', wrapHandlerWithArg((planId: string) => subscriptionService.downgradeSubscription(planId)));
  
  ipcMain.handle('cloud:subscription:cancel', wrapHandlerWithArg((reason?: string) => subscriptionService.cancelSubscription(reason)));
  
  ipcMain.handle('cloud:subscription:renew', wrapHandler(() => subscriptionService.renewSubscription()));
  
  ipcMain.handle('cloud:subscription:enableAutoRenew', wrapHandler(() => subscriptionService.enableAutoRenew()));
  
  ipcMain.handle('cloud:subscription:disableAutoRenew', wrapHandler(() => subscriptionService.disableAutoRenew()));
  
  ipcMain.handle('cloud:subscription:getUsage', wrapHandler(() => subscriptionService.getUsage()));
  
  ipcMain.handle('cloud:subscription:comparePlans', wrapHandler(() => subscriptionService.comparePlans()));

  ipcMain.handle('cloud:subscription:getPayments', wrapHandler(() => {
    const deviceId = generateDeviceFingerprint().fingerprint;
    return subscriptionService.getPayments(deviceId);
  }));

  ipcMain.handle('cloud:subscription:submitOfflinePayment', wrapHandlerWithArg((params: any) => subscriptionService.submitOfflinePayment(params)));

  ipcMain.handle('cloud:subscription:getInvoices', wrapHandler(() => subscriptionService.getInvoices()));

  ipcMain.handle('cloud:subscription:createInvoice', wrapHandlerWithArg((params: any) => subscriptionService.createInvoice(params)));
}
