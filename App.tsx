// 灵境IDE 移动端 - 应用入口 (合并 lingjing-mobile + mobile 全部功能)
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/services/api';
import { useAppStore } from './src/stores/app-store';
import * as Notifications from './src/services/notifications';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import QuestScreen from './src/screens/QuestScreen';
import PlanScreen from './src/screens/PlanScreen';
import SchedulesScreen from './src/screens/SchedulesScreen';
import FileTreeScreen from './src/screens/FileTreeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import PairingScreen from './src/screens/PairingScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import ConnectionBanner from './src/components/ConnectionBanner';
import { loadPersistedAuth } from './src/stores/app-store';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ChatStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#c9d1d9' }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: '对话' }} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ title: '对话详情' }} />
    </Stack.Navigator>
  );
}

function SettingsStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#c9d1d9' }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} options={{ title: '设置' }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: '订阅管理' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const { connected, mode, token, lanIp, setConnection, setToken, setLanIp, setStatus, setAuth, setUser } = useAppStore();
  const [initializing, setInitializing] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [loadingText, setLoadingText] = useState('正在连接灵境...');
  const [updateReady, setUpdateReady] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // OTA hot update: expo-updates auto-checks on load (ON_LOAD),
  // we poll for a ready update after init and auto-reload
  useEffect(() => {
    if (initializing) return; // wait until init done
    let cancelled = false;
    async function tryReload() {
      try {
        const u = await Updates.checkForUpdateAsync();
        if (u.isAvailable && !cancelled) {
          const result = await Updates.fetchUpdateAsync();
          if (result.isNew && !cancelled) {
            setUpdateReady(true);
            // Brief delay so user sees any loading screen, then reload
            setTimeout(() => {
              if (!cancelled) Updates.reloadAsync();
            }, 200);
          }
        }
      } catch {
        // Silent fail — never block the user
      }
    }
    tryReload();
    return () => { cancelled = true; };
  }, [initializing]);

  useEffect(() => {
    initConnection();
  }, []);

  async function initConnection() {
    // Phase 1: Check for persisted cloud account token
    const persisted = await loadPersistedAuth();
    if (persisted?.token) {
      // Try cloud server auth with persisted token
      setLoadingText('正在验证云账号...');
      api.configure({
        baseUrl: 'https://ide.zhejiangjinmo.com',
        token: persisted.token,
        wsUrl: 'wss://ide.zhejiangjinmo.com/ws',
      });
      try {
        const me = await api.verifyToken();
        if (me.ok) {
          // Token is valid, use cloud mode
          setAuth(me.user?.id || 'cloud_user', persisted.token);
          if (persisted.user) setUser(persisted.user);
          api.connectWs();
          setConnection(true, 'cloud_account', 'https://ide.zhejiangjinmo.com');
          setInitializing(false);
          return;
        }
      } catch { /* token invalid or expired, fall through to login */ }
    }

    // Phase 2: Check for pairing token (desktop connection)
    if (token) {
      const storedIp = lanIp || '';
      if (!storedIp) {
        setLoadingText('请先配对桌面端IP');
        setShowPairing(true);
        setInitializing(false);
        return;
      }

      // LAN
      setLoadingText('正在连接局域网...');
      try {
        const lanUrl = `http://${storedIp}:3001`;
        api.configure({ baseUrl: lanUrl, token, wsUrl: `ws://${storedIp}:3001/ws` });
        const res = await fetch(`${lanUrl}/api/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          api.connectWs();
          setConnection(true, 'lan', lanUrl);
          setStatus(data);
          setInitializing(false);
          Notifications.registerPushToken(token, '灵境 Mobile').catch(() => {});
          return;
        }
      } catch { /* LAN failed, try Cloud */ }

      // Cloud (pairing mode)
      setLoadingText('正在连接云服务器...');
      try {
        const cloudUrl = 'https://ide.zhejiangjinmo.com';
        api.configure({ baseUrl: cloudUrl, token, wsUrl: 'wss://ide.zhejiangjinmo.com/ws' });
        const res = await fetch(`${cloudUrl}/api/health`);
        if (res.ok) {
          api.connectWs();
          setConnection(true, 'cloud', cloudUrl);
          setInitializing(false);
          Notifications.registerPushToken(token, '灵境 Mobile').catch(() => {});
          return;
        }
      } catch { /* Cloud also failed */ }
    }

    // Phase 3: No valid auth → show login screen
    setShowLogin(true);
    setInitializing(false);
  }

  async function handlePaired(newToken: string, newIp: string) {
    setToken(newToken);
    setLanIp(newIp);
    setShowPairing(false);
    try {
      const s = await api.getStatus();
      setStatus(s);
    } catch { /* ignore */ }
    Notifications.registerPushToken(newToken, '灵境 Mobile').catch(() => {});
  }

  function handleLoginSuccess() {
    setShowLogin(false);
    // Connect to cloud server as cloud_account mode
    api.configure({
      baseUrl: 'https://ide.zhejiangjinmo.com',
      token: useAppStore.getState().token,
      wsUrl: 'wss://ide.zhejiangjinmo.com/ws',
    });
    api.connectWs();
    setConnection(true, 'cloud_account', 'https://ide.zhejiangjinmo.com');
    try {
      api.getStatus().then(setStatus).catch(() => {});
    } catch { /* ignore */ }
    Notifications.registerPushToken(useAppStore.getState().token, '灵境 Mobile').catch(() => {});
  }

  function switchToPairing() {
    setShowLogin(false);
    setShowPairing(true);
  }

  function switchToLogin() {
    setShowPairing(false);
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
    return <LoginScreen onSuccess={handleLoginSuccess} onSwitchToPairing={switchToPairing} />;
  }

  if (showPairing) {
    return <PairingScreen onSuccess={handlePaired} onSwitchToLogin={switchToLogin} />;
  }

  return (
    <ErrorBoundary><SafeAreaProvider>
      <NavigationContainer theme={{
        dark: isDark,
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' as const },
          medium: { fontFamily: 'System', fontWeight: '500' as const },
          bold: { fontFamily: 'System', fontWeight: '700' as const },
          heavy: { fontFamily: 'System', fontWeight: '900' as const },
        },
        colors: isDark ? {
          primary: '#58a6ff',
          background: '#0d1117',
          card: '#161b22',
          text: '#c9d1d9',
          border: '#30363d',
          notification: '#f85149',
        } : {
          primary: '#0969da',
          background: '#ffffff',
          card: '#f6f8fa',
          text: '#1f2328',
          border: '#d0d7de',
          notification: '#cf222e',
        },
      }}>
        <ConnectionBanner />
        <Tab.Navigator screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              ChatTab: 'chatbubbles',
              QuestTab: 'checkmark-circle',
              PlanTab: 'map',
              FilesTab: 'folder-open',
              SchedulesTab: 'time',
              SettingsTab: 'settings',
            };
            return <Ionicons name={icons[route.name] || 'apps'} size={size} color={color} />;
          },
          tabBarActiveTintColor: isDark ? '#58a6ff' : '#0969da',
          tabBarInactiveTintColor: isDark ? '#8b949e' : '#656d76',
          tabBarStyle: {
            backgroundColor: isDark ? '#161b22' : '#f6f8fa',
            borderTopColor: isDark ? '#30363d' : '#d0d7de',
          },
        })}>
          <Tab.Screen name="ChatTab" component={ChatStackScreen} options={{ title: '对话' }} />
          <Tab.Screen name="QuestTab" component={QuestScreen} options={{ title: '任务' }} />
          <Tab.Screen name="PlanTab" component={PlanScreen} options={{ title: '计划' }} />
          <Tab.Screen name="FilesTab" component={FileTreeScreen} options={{ title: '文件' }} />
          <Tab.Screen name="SchedulesTab" component={SchedulesScreen} options={{ title: '定时' }} />
          <Tab.Screen name="SettingsTab" component={SettingsStackScreen} options={{ title: '设置' }} />
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </SafeAreaProvider></ErrorBoundary>
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
});
