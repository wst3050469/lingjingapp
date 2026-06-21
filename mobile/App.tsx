// 灵境IDE 移动端 - 极简同步终端 (The Thin Client)
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
import { ErrorBoundary } from './src/components/ErrorBoundary';
import ConnectionBanner from './src/components/ConnectionBanner';
import UpdateChecker from './src/components/UpdateChecker';
import { loadPersistedAuth } from './src/stores/app-store';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

// ── Connection Constants ──
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS } from './src/constants';

// 仅保留核心页面导入
import ChatListScreen from './src/screens/ChatListScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function ChatStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#0d1117' }, headerTintColor: '#c9d1d9' }}>
      <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: '对话列表' }} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={{ title: '对话详情' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  const { connected, setConnection, setAuth, setUser } = useAppStore();
  const [initializing, setInitializing] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [loadingText, setLoadingText] = useState('正在连接灵境...');
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  useEffect(() => {
    initConnection();
  }, []);

  async function initConnection() {
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
      } catch {
        // token expired
      }
    }
    setShowLogin(true);
    setInitializing(false);
  }

  async function handleLoginSuccess() {
    setShowLogin(false);
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
        <UpdateChecker />
        <NavigationContainer theme={{
          dark: isDarkMode,
          colors: isDarkMode ? {
            primary: '#58a6ff',
            background: '#0d1117',
            card: '#161b22',
            text: '#c9d1d9',
            border: '#30363d',
          } : {
            primary: '#0969da',
            background: '#ffffff',
            card: '#f6f8fa',
            text: '#1f2328',
            border: '#d0d7de',
          },
        }}>
          <ConnectionBanner />
          <Tab.Navigator screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ color, size }: any) => {
              const icons: Record<string, string> = {
                ChatTab: 'chatbubbles',
              };
              return <Ionicons name={icons[route.name] as any} size={size} color={color} />;
            },
            tabBarActiveTintColor: isDarkMode ? '#58a6ff' : '#0969da',
            tabBarInactiveTintColor: isDarkMode ? '#8b949e' : '#656d76',
            tabBarStyle: {
              backgroundColor: isDarkMode ? '#161b22' : '#f6f8fa',
              borderTopColor: isDarkMode ? '#30363d' : '#d0d7de',
            },
          })}>
            <Tab.Screen name="ChatTab" component={ChatStackScreen} options={{ title: '对话' }} />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
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
});
