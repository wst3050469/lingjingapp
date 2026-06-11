import { createVerify } from 'node:crypto';

const APNS_CERT_PATH = process.env.APNS_CERT_PATH;
const APNS_KEY_PATH = process.env.APNS_KEY_PATH;
const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || 'com.lingjing.ide';
const APNS_PRODUCTION = process.env.APNS_PRODUCTION !== 'false';

const isConfigured = !!(APNS_CERT_PATH && APNS_KEY_PATH);

if (!isConfigured) {
  console.log('[APNs] 模拟模式：未配置证书 (APNS_CERT_PATH/APNS_KEY_PATH)');
}

export class ApnsProvider {
  constructor() {
    this.simulationMode = !isConfigured;
  }

  async sendNotification(deviceToken, payload) {
    if (this.simulationMode) {
      console.log('[APNs] 模拟推送:', { token: deviceToken.slice(0, 8) + '...', title: payload.title });
      return { success: true, apnsId: `sim-apns-${Date.now().toString(36)}`, simulated: true };
    }

    try {
      const apn = await import('apn');
      const provider = new apn.Provider({
        cert: APNS_CERT_PATH,
        key: APNS_KEY_PATH,
        production: APNS_PRODUCTION,
      });
      const notification = new apn.Notification();
      notification.alert = { title: payload.title, body: payload.body };
      notification.topic = APNS_BUNDLE_ID;
      notification.payload = payload.data || {};
      const result = await provider.send(notification, deviceToken);
      provider.shutdown();
      if (result.failed && result.failed.length > 0) {
        console.error('[APNs] 发送失败:', result.failed[0]);
        return { success: false, error: result.failed[0].status };
      }
      return { success: true, apnsId: result.sent[0]?.device };
    } catch (err) {
      console.error('[APNs] 发送异常:', err.message);
      return { success: false, error: err.message };
    }
  }
}

export const apnsProvider = new ApnsProvider();
