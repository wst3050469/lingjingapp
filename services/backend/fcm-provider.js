import { readFileSync } from 'node:fs';

const FCM_SERVICE_ACCOUNT_KEY = process.env.FCM_SERVICE_ACCOUNT_KEY;
const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID;

const isConfigured = !!(FCM_SERVICE_ACCOUNT_KEY || FCM_PROJECT_ID);

if (!isConfigured) {
  console.log('[FCM] 模拟模式：未配置服务账号 (FCM_SERVICE_ACCOUNT_KEY/FCM_PROJECT_ID)');
}

export class FcmProvider {
  constructor() {
    this.simulationMode = !isConfigured;
    this.app = null;
    if (isConfigured && FCM_SERVICE_ACCOUNT_KEY) {
      this._initFirebase().catch(err => {
        console.error('[FCM] Firebase初始化失败:', err.message);
        this.simulationMode = true;
      });
    }
  }

  async _initFirebase() {
    const admin = await import('firebase-admin');
      const serviceAccount = JSON.parse(readFileSync(FCM_SERVICE_ACCOUNT_KEY, 'utf8'));
    this.app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    }, 'lingjing-fcm');
  }

  async sendNotification(deviceToken, payload) {
    if (this.simulationMode || !this.app) {
      console.log('[FCM] 模拟推送:', { token: deviceToken.slice(0, 8) + '...', title: payload.title });
      return { success: true, messageId: `sim-fcm-${Date.now().toString(36)}`, simulated: true };
    }

    try {
      const admin = await import('firebase-admin');
      const message = {
        token: deviceToken,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
      };
      const response = await admin.messaging(this.app).send(message);
      return { success: true, messageId: response };
    } catch (err) {
      console.error('[FCM] 发送异常:', err.message);
      return { success: false, error: err.message };
    }
  }

  async sendToTopic(topic, payload) {
    if (this.simulationMode || !this.app) {
      console.log('[FCM] 模拟Topic推送:', { topic, title: payload.title });
      return { success: true, messageId: `sim-fcm-topic-${Date.now().toString(36)}`, simulated: true };
    }

    try {
      const admin = await import('firebase-admin');
      const message = {
        topic,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
      };
      const response = await admin.messaging(this.app).send(message);
      return { success: true, messageId: response };
    } catch (err) {
      console.error('[FCM] Topic推送异常:', err.message);
      return { success: false, error: err.message };
    }
  }
}

export const fcmProvider = new FcmProvider();
