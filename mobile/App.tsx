// 灵境AI 移动端
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './src/services/api';
import { useAppStore, loadPersistedAuth } from './src/stores/app-store';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import ConnectionBanner from './src/components/ConnectionBanner';
import UpdateChecker from './src/components/UpdateChecker';
import { View, Text, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS } from './src/constants';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatDetailScreen from './src/screens/ChatDetailScreen';
import LoginScreen from './src/screens/LoginScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const { connected, setConnection, setAuth, setUser } = useAppStore();
  const [initializing, setInitializing] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [loadingText, setLoadingText] = useState('正在连接灵境AI...');
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  useEffect(() => { initConnection(); }, []);

  async function initConnection() {
    const persisted = await loadPersistedAuth();
    if (persisted?.token) {
      setLoadingText('正在验证云账号...');
      api.configure({ baseUrl: CLOUD_SERVER_URL, token: persisted.token, wsUrl: CLOUD_SERVER_WS });
      try {
        const me = await api.verifyToken();
        if (me.ok) {
          setAuth(me.user?.id || persisted.token.slice(0, 8), persisted.token);
          if (persisted.user) setUser(persisted.user);
          api.connectWs();
          setConnection(true, 'cloud_account', CLOUD_SERVER_URL);
          setInitializing(false);
          return;
        }
      } catch { /* token 过期 → 进入登录页 */ }
      await api.cloudLogout();
      useAppStore.getState().logout();
    }
    setShowLogin(true);
    setInitializing(false);
  }

  function handleLoginSuccess() {
    setShowLogin(false);
    const token = useAppStore.getState().token;
    api.configure({ baseUrl: CLOUD_SERVER_URL, token, wsUrl: CLOUD_SERVER_WS });
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
    return (
      <SafeAreaProvider>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer theme={isDarkMode
          ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: '#58a6ff', background: '#0d1117', card: '#161b22', text: '#c9d1d9', border: '#30363d', notification: '#f85149' } }
          : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: '#0969da', background: '#ffffff', card: '#f6f8fa', text: '#1f2328', border: '#d0d7de', notification: '#cf222e' } }
        }>
          <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: isDarkMode ? '#161b22' : '#f6f8fa' }, headerTintColor: isDarkMode ? '#c9d1d9' : '#1f2328' }}>
            <Stack.Screen name="ChatList" component={ChatListScreen} options={{ title: '对话' }} />
            <Stack.Screen name="ChatDetail" component={ChatDetailScreen} options={({ route }: any) => ({ title: route?.params?.title || '对话详情' })} />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b949e', marginTop: 12, fontSize: 14 },
});
