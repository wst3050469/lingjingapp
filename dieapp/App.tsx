// 灵境 AI 编程助手 - 移动端入口
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { ErrorBoundary } from './src/components/ui';
import ConnectionBanner from './src/components/ConnectionBanner';
import UpdateChecker from './src/components/UpdateChecker';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  const colorScheme = useColorScheme();

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
