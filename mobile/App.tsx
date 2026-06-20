// 灵境IDE 移动端 - 应用入口 (合并 lingjing-mobile + mobile 全部功能)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
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
import LoginScreen from './src/screens/LoginScreen';
import PairingScreen from './src/screens/PairingScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import ConnectionBanner from './src/components/ConnectionBanner';
import UpdateChecker from './src/components/UpdateChecker';
import { loadPersistedAuth } from './src/stores/app-store';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme, Platform } from 'react-native';

// ── Connection Constants (from shared constants file) ──
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS } from './src/constants';

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
  const { connected, setConnection, setAuth, setUser } = useAppStore();
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
    // Auto-configure from cloud account
    const persisted = await loadPersistedAuth();
    if (persisted?.token) {
      setLoadingText('正在连接灵境云...');
      api.configure({
        baseUrl: CLOUD_SERVER_URL,
        token: persisted.token,
        wsUrl: CLOUD_SERVER_WS,
      });
      try {
        const me = await api.verifyToken();
        if (me && me.ok !== false) {
          setAuth(me.user?.id || 'cloud_user', persisted.token);
          if (persisted.user) setUser(persisted.user);
          setConnection(true, 'cloud_account', CLOUD_SERVER_URL);
          api.connectWs();
          setInitializing(false);
          return;
        }
      } catch { /* token expired, proceed to login */ }
    }

    // No valid token → show login as default entry
    setShowLogin(true);
    setInitializing(false);
  }

  async function handleLoginSuccess() {
    setShowLogin(false);
    setShowPairing(false);
    const state = useAppStore.getState();
    const cloudToken = state.cloudToken || state.token;
    api.configure({
      baseUrl: CLOUD_SERVER_URL,
      token: cloudToken,
      wsUrl: CLOUD_SERVER_WS,
    });
    api.connectWs();
    setConnection(true, 'cloud_account', CLOUD_SERVER_URL);
  }

  function handlePairingSuccess() {
    setShowPairing(false);
    setShowLogin(false);
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

  // ── 配对连接桌面端 ──
  if (showPairing) {
    return (
      <PairingScreen
        onSuccess={handlePairingSuccess}
        onSwitchToLogin={switchToLogin}
      />
    );
  }

  // ── 云账号登录 ──
  if (showLogin) {
    return (
      <LoginScreen
        onSuccess={handleLoginSuccess}
        onSwitchToPairing={switchToPairing}
      />
    );
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
