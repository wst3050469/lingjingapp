// 灵境AI 移动端轻量版 - 纯对话·实时同步
// v2: 精简为 Login → ChatList → ChatDetail 纯Stack导航
//     复杂设置/配对/任务/计划/文件/定时 保留在PC端
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/services/api';
import { useAppStore } from './src/stores/app-store';
import * as Notifications from './src/services/notifications';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { loadPersistedAuth } from './src/stores/app-store';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';

const Stack = createNativeStackNavigator();

export default function App() {
  const { setConnection, setAuth, setUser, logout, user } = useAppStore();
  const [initializing, setInitializing] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [loadingText, setLoadingText] = useState('正在连接灵境AI...');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // OTA hot update
  useEffect(() => {
    if (initializing) return;
    let cancelled = false;
    async function tryReload() {
      try {
        const u = await Updates.checkForUpdateAsync();
        if (u.isAvailable && !cancelled) {
          const result = await Updates.fetchUpdateAsync();
          if (result.isNew && !cancelled) {
            setTimeout(() => { if (!cancelled) Updates.reloadAsync(); }, 200);
          }
        }
      } catch { /* silent */ }
    }
    tryReload();
    return () => { cancelled = true; };
  }, [initializing]);

  useEffect(() => { initConnection(); }, []);

  async function initConnection() {
    // Phase 1: 检查本地持久化的云账号 token
    const persisted = await loadPersistedAuth();
    if (persisted?.token) {
      setLoadingText('正在验证云账号...');
      api.configure({
        baseUrl: 'https://ide.zhejiangjinmo.com',
        token: persisted.token,
        wsUrl: 'wss://ide.zhejiangjinmo.com/ws',
      });
      try {
        const me = await api.verifyToken();
        if (me.ok) {
          setAuth(me.user?.id || persisted.token.slice(0, 8), persisted.token);
          if (persisted.user) setUser(persisted.user);
          api.connectWs();
          setConnection(true, 'cloud_account', 'https://ide.zhejiangjinmo.com');
          setInitializing(false);
          Notifications.registerPushToken(persisted.token, '灵境AI Mobile').catch(() => {});
          return;
        }
      } catch { /* token 过期 → 进入登录页 */ }
      // Token 无效，清除本地状态
      await api.cloudLogout();
      logout();
    }

    // Phase 2: 无有效 token → 显示登录页
    setShowLogin(true);
    setInitializing(false);
  }

  function handleLoginSuccess() {
    setShowLogin(false);
    const token = useAppStore.getState().token;
    api.configure({
      baseUrl: 'https://ide.zhejiangjinmo.com',
      token,
      wsUrl: 'wss://ide.zhejiangjinmo.com/ws',
    });
    api.connectWs();
    setConnection(true, 'cloud_account', 'https://ide.zhejiangjinmo.com');
    Notifications.registerPushToken(token, '灵境AI Mobile').catch(() => {});
  }

  function handleLogout() {
    api.cloudLogout().catch(() => {});
    logout();
    setShowLogin(true);
  }

  if (initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#58a6ff" />
        <Text style={styles.loadingText}>{loadingText}</Text>
      </View>
    );
  }

  if (showLogin) {
    return <LoginScreen onSuccess={handleLoginSuccess} />;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer theme={isDark
          ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: '#58a6ff', background: '#0d1117', card: '#161b22', text: '#c9d1d9', border: '#30363d', notification: '#f85149' } }
          : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: '#0969da', background: '#ffffff', card: '#f6f8fa', text: '#1f2328', border: '#d0d7de', notification: '#cf222e' } }
        }>
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: isDark ? '#161b22' : '#f6f8fa' },
              headerTintColor: isDark ? '#c9d1d9' : '#1f2328',
            }}
          >
            <Stack.Screen
              name="ChatList"
              component={ChatListScreen}
              options={{
                title: '对话',
                headerRight: () => user ? (
                  <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
                    <Ionicons name="person-circle-outline" size={24} color="#58a6ff" />
                    <Text style={styles.headerUser} numberOfLines={1}>{user.username}</Text>
                  </TouchableOpacity>
                ) : undefined,
              }}
            />
            <Stack.Screen
              name="ChatDetail"
              component={ChatDetailScreen}
              options={({ route }: any) => ({
                title: route?.params?.title || '对话详情',
              })}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1, backgroundColor: '#0d1117',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: {
    color: '#8b949e', marginTop: 12, fontSize: 16,
  },
  headerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  headerUser: {
    color: '#8b949e', fontSize: 12, maxWidth: 80,
  },
});
