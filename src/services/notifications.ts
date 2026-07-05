// 灵境AIIDE 移动端 - Push Notifications 服务 (Expo)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CLOUD_SERVER = 'https://ide.zhejiangjinmo.com';

// Configure how notifications appear when app is foregrounded
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
      console.log('[Push] Permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'lingjing-mobile', // Expo project ID
    });

    pushToken = tokenData.data;
    console.log('[Push] Token obtained:', (tokenData.data || '').substring(0, 8) + '...');

    // Android: create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('lingjing-default', {
        name: '灵境AI通知',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#58a6ff',
        description: '灵境AIIDE 消息通知',
      });
    }

    return pushToken;
  } catch (err) {
    console.error('[Push] Failed to get token:', err);
    return null;
  }
}

/**
 * Register push token with cloud server
 * Called once on app startup after pairing succeeds
 */
export async function registerPushToken(
  desktopToken: string,
  deviceName: string = 'Android',
): Promise<boolean> {
  const token = await getPushToken();
  if (!token) return false;

  try {
    const res = await fetch(`${CLOUD_SERVER}/api/notifications/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${desktopToken}`,
      },
      body: JSON.stringify({
        pushToken: token,
        platform: Platform.OS,
        deviceName,
      }),
    });
    if (res.ok) {
      console.log('[Push] Token registered with server');
      return true;
    }
    console.warn('[Push] Register failed:', res.status);
    return false;
  } catch (err) {
    console.warn('[Push] Register error:', err);
    return false;
  }
}

/**
 * Listen for incoming notifications (foreground handler already set above)
 */
export function addNotificationListener(
  callback: (notification: Notifications.Notification) => void,
): () => void {
  const subscription = Notifications.addNotificationReceivedListener(callback);
  return () => subscription.remove();
}

/**
 * Handle notification tap (when user taps notification to open app)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  return () => subscription.remove();
}

export { pushToken };
