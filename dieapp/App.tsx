// 灵境 AI 编程助手 - 移动端入口
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { ErrorBoundary } from './src/components/ui';
import ConnectionBanner from './src/components/ConnectionBanner';
import UpdateChecker from './src/components/UpdateChecker';
import RootNavigator from './src/navigation/RootNavigator';
import { refreshPushToken, registerPushToken, addNotificationListener, addNotificationResponseListener } from './src/services/notifications';

export default function App() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // 初始化推送通知
    initNotifications();
  }, []);

  async function initNotifications() {
    const token = await refreshPushToken();
    if (token) {
      // 通知监听：前台收到通知
      addNotificationListener(notification => {
        console.log('[Push] 收到通知:', notification.request.content.title);
      });
      // 通知点击：用户点击通知打开App
      addNotificationResponseListener(response => {
        console.log('[Push] 用户点击通知:', response.notification.request.content.title);
      });
    }
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <UpdateChecker />
        <ConnectionBanner />
        <RootNavigator />
        <StatusBar style={colorScheme === 'light' ? 'dark' : 'light'} />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
