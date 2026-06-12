// 根导航控制器 - Splash → Auth → Main 三态切换
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useAppStore, loadPersistedAuth } from '../stores/app-store';
import { api } from '../services/api';
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS, Colors } from '../constants';
import { registerPushToken } from '../services/notifications';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import SplashScreen from '../screens/SplashScreen';

export default function RootNavigator() {
  const { isLoggedIn, token, setAuth, setUser, setConnection, themeMode } = useAppStore();
  const [phase, setPhase] = useState<'splash' | 'auth' | 'main'>('splash');
  const [loadingText, setLoadingText] = useState('正在连接灵境...');

  useEffect(() => {
    initApp();
  }, []);

  // 登录成功后注册推送Token
  useEffect(() => {
    if (isLoggedIn && token) {
      registerPushToken(token).catch(() => {});
    }
  }, [isLoggedIn, token]);

  async function initApp() {
    // 闪屏展示 1.5s
    await new Promise(r => setTimeout(r, 1500));
    setLoadingText('正在验证身份...');

    // 尝试恢复认证
    const persisted = await loadPersistedAuth();
    if (persisted?.token) {
      api.configure({ baseUrl: CLOUD_SERVER_URL, token: persisted.token, wsUrl: CLOUD_SERVER_WS });
      try {
        const me = await api.verifyToken();
        if (me.ok && me.data?.user) {
          setAuth(me.data.user.id, persisted.token);
          if (persisted.user) setUser(persisted.user);
          setConnection(true, 'cloud_account', CLOUD_SERVER_URL);
          api.connectWs();
          registerPushToken(persisted.token).catch(() => {}); // 注册推送Token
          setPhase('main');
          return;
        }
      } catch {}
    }
    // 未登录 → 认证页
    setPhase('auth');
  }

  if (phase === 'splash') {
    return <SplashScreen loadingText={loadingText} />;
  }

  const isDark = themeMode === 'dark' || themeMode === 'system';

  return (
    <NavigationContainer theme={isDark ? DarkTheme : DefaultTheme}>
      {phase === 'auth' ? (
        <AuthNavigator onLoginSuccess={() => setPhase('main')} />
      ) : (
        <MainNavigator />
      )}
    </NavigationContainer>
  );
}
