// 灵境IDE 移动端 - 应用入口 (合并 lingjing-mobile + mobile 全部功能)
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
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
import CodeEditorScreen from './src/screens/CodeEditorScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import PipelineScreen from './src/screens/PipelineScreen';
import RequirementScreen from './src/screens/RequirementScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import PairingScreen from './src/screens/PairingScreen';
import LoginScreen from './src/screens/LoginScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import ConnectionBanner from './src/components/ConnectionBanner';
import UpdateChecker from './src/components/UpdateChecker';
import { loadPersistedAuth, loadPersistedPairing } from './src/stores/app-store';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme, Platform } from 'react-native';

// ── Connection Constants (from shared constants file) ──
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS, FRP_RELAY_URL, FRP_RELAY_WS } from './src/constants';

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

// 文件浏览 → 代码编辑器
function FileStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#c9d1d9' }}>
      <Stack.Screen name="FileTree" component={FileTreeScreen} options={{ title: '文件' }} />
      <Stack.Screen name="CodeEditor" component={CodeEditorScreen} options={{ title: '编辑器' }} />
    </Stack.Navigator>
  );
}

// 开发工具：需求 + 审批 + CI/CD
function DevStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#c9d1d9' }}>
      <Stack.Screen name="RequirementList" component={RequirementScreen} options={{ title: '需求' }} />
      <Stack.Screen name="ReviewBoard" component={ReviewScreen} options={{ title: '审批' }} />
      <Stack.Screen name="PipelineStatus" component={PipelineScreen} options={{ title: 'CI/CD' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const { connected, mode, token, lanIp, setConnection, setToken, setLanIp, setStatus, setAuth, setUser } = useAppStore();
  const [initializing, setInitializing] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [loadingText, setLoadingText] = useState('正在连接灵境...');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    initConnection();
  }, []);

  async function initConnection() {
    // Phase 0: Load persisted pairing info (separate from cloud auth)
    const pairing = await loadPersistedPairing();
    if (pairing) {
      setToken(pairing.token);
      setLanIp(pairing.lanIp);
    }

    // Phase 1: Check for persisted cloud account token (JWT)
    const persisted = await loadPersistedAuth();
    if (persisted?.token) {
      setLoadingText('正在验证云账号...');
      api.configure({
        baseUrl: CLOUD_SERVER_URL,
        token: persisted.token,
        wsUrl: CLOUD_SERVER_WS,
      });
      try {
        const me = await api.verifyToken();
        if (me && me.ok !== false) {
          // Token is valid, use cloud mode
          setAuth(me.user?.id || 'cloud_user', persisted.token);
          if (persisted.user) setUser(persisted.user);
          // If pairing exists, use local web-server for sessions (higher priority for data access)
          if (pairing) {
            const pairingUrl = `http://${pairing.lanIp}:3001`;
            // Verify pairing token against desktop web-server before using it
            try {
              const statusRes = await fetch(`${pairingUrl}/api/status`, {
                headers: { Authorization: `Bearer ${pairing.token}` },
              });
              if (statusRes.ok) {
                api.configure({ baseUrl: pairingUrl, token: pairing.token, wsUrl: `ws://${pairing.lanIp}:3001/ws` });
                api.connectWs();
                const statusData = await statusRes.json();
                setStatus(statusData);
                setConnection(true, 'cloud_account', pairingUrl);
                setInitializing(false);
                Notifications.registerPushToken(pairing.token, '灵境 Mobile').catch(() => {});
                return;
              }
            } catch { /* LAN unreachable, use cloud server */ }
          }
          // Fallback: use cloud server directly
          api.configure({ baseUrl: CLOUD_SERVER_URL, token: persisted.token, wsUrl: CLOUD_SERVER_WS });
          api.connectWs();
          setConnection(true, 'cloud_account', CLOUD_SERVER_URL);
          setInitializing(false);
          return;
        }
      } catch { /* token invalid or expired, fall through to pairing or login */ }
    }

    // Phase 2: Pairing mode — try to connect to desktop via LAN or FRP relay
    const storedToken = token || pairing?.token || '';
    const storedIp = lanIp || pairing?.lanIp || '';

    if (storedToken) {
      // ── Attempt 1: LAN direct ──
      if (storedIp) {
        setLoadingText('正在连接局域网...');
        try {
          const lanUrl = `http://${storedIp}:3001`;
          api.configure({ baseUrl: lanUrl, token: storedToken, wsUrl: `ws://${storedIp}:3001/ws` });
          const res = await fetch(`${lanUrl}/api/status`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            api.connectWs();
            setConnection(true, 'lan', lanUrl);
            setStatus(data);
            setInitializing(false);
            Notifications.registerPushToken(storedToken, '灵境 Mobile').catch(() => {});
            return;
          }
        } catch { /* LAN failed */ }
      }

      // ── Attempt 2: FRP relay (cloud tunnel to desktop) ──
      setLoadingText('正在通过中转连接...');
      try {
        api.configure({ baseUrl: FRP_RELAY_URL, token: storedToken, wsUrl: FRP_RELAY_WS });
        const res = await fetch(`${FRP_RELAY_URL}/api/sessions?limit=1`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          api.connectWs();
          setConnection(true, 'cloud', FRP_RELAY_URL);
          if (data && data.device) setStatus(data);
          setInitializing(false);
          Notifications.registerPushToken(storedToken, '灵境 Mobile').catch(() => {});
          return;
        }
      } catch { /* FRP relay also failed */ }

      // ── Both LAN and FRP failed → show pairing screen to retry ──
      setLoadingText('连接失败，请重新配对');
      setShowPairing(true);
      setInitializing(false);
      return;
    }

    // Phase 3: No auth info at all → show login
    setShowLogin(true);
    setInitializing(false);
  }

  async function handlePaired(newToken: string, newIp: string) {
    setToken(newToken);
    setLanIp(newIp);
    useAppStore.setState({ pairingToken: newToken, pairingLanIp: newIp });
    setShowPairing(false);
    try {
      const s = await api.getStatus();
      setStatus(s);
    } catch { /* ignore */ }
    Notifications.registerPushToken(newToken, '灵境 Mobile').catch(() => {});
  }

  async function handleLoginSuccess() {
    setShowLogin(false);
    const state = useAppStore.getState();
    if (state.pairingToken && state.pairingLanIp) {
      const pairingUrl = `http://${state.pairingLanIp}:3001`;
      api.configure({
        baseUrl: pairingUrl,
        token: state.pairingToken,
        wsUrl: `ws://${state.pairingLanIp}:3001/ws`,
      });
      try {
        const status = await api.getStatus();
        api.connectWs();
        setConnection(true, 'cloud_account', pairingUrl);
        setStatus(status);
        Notifications.registerPushToken(state.pairingToken, '灵境 Mobile').catch(() => {});
        return;
      } catch {
        console.log('[App] Pairing unreachable after login, using cloud server');
      }
    }
    const cloudToken = state.cloudToken || state.token;
    api.configure({
      baseUrl: CLOUD_SERVER_URL,
      token: cloudToken,
      wsUrl: CLOUD_SERVER_WS,
    });
    api.connectWs();
    setConnection(true, 'cloud_account', CLOUD_SERVER_URL);
    try {
      api.getStatus().then(setStatus).catch(() => {});
    } catch { /* ignore */ }
    Notifications.registerPushToken(cloudToken, '灵境 Mobile').catch(() => {});
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
      <UpdateChecker />
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
              DevTab: 'code-slash',
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
          <Tab.Screen name="DevTab" component={DevStackScreen} options={{ title: '开发' }} />
          <Tab.Screen name="FilesTab" component={FileStackScreen} options={{ title: '文件' }} />
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
