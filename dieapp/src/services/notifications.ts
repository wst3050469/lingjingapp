// 灵境 AI 编程助手 - Push Notifications 服务 (Expo)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { CLOUD_SERVER_URL } from '../constants';

// 配置前台通知展示
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

let pushToken: string | null = null;

export async function getPushToken(): Promise<string | null> {
  if (pushToken) return pushToken;
  return refreshPushToken();
}

export async function refreshPushToken(): Promise<string | null> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push] 权限未授予');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'lingjing-dieapp',
    });

    pushToken = tokenData.data;
    console.log('[Push] Token:', (tokenData.data || '').substring(0, 8) + '...');

    // Android: 创建通知渠道
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('lingjing-dieapp-default', {
        name: '灵境通知',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#58a6ff',
        description: '灵境 AI 编程助手消息通知',
      });
    }

    return pushToken;
  } catch (err) {
    console.error('[Push] 获取Token失败:', err);
    return null;
  }
}

/**
 * 向云服务器注册 Push Token
 */
export async function registerPushToken(
  cloudToken: string,
  deviceName: string = 'Android',
): Promise<boolean> {
  const token = await getPushToken();
  if (!token) return false;

  try {
    const res = await fetch(`${CLOUD_SERVER_URL}/api/notifications/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cloudToken}`,
      },
      body: JSON.stringify({
        pushToken: token,
        platform: Platform.OS,
        deviceName,
      }),
    });
    if (res.ok) {
      console.log('[Push] Token 已注册到服务器');
      return true;
    }
    console.warn('[Push] 注册失败:', res.status);
    return false;
  } catch (err) {
    console.warn('[Push] 注册错误:', err);
    return false;
  }
}

/**
 * 监听收到的通知（前台）
 */
export function addNotificationListener(
  callback: (notification: Notifications.Notification) => void,
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
}

/**
 * 监听通知点击（用户点击通知打开App）
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  return () => subscription.remove();
}

export { pushToken };
