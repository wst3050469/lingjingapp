// 连接状态栏
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../stores/app-store';

export default function ConnectionBanner() {
  const { connected, mode, lanIp } = useAppStore();

  function modeLabel(): string {
    switch (mode) {
      case 'lan': return `LAN ${lanIp || ''}`;
      case 'cloud': return 'FRP 中转';
      case 'cloud_account': return '云账号';
      default: return 'Cloud';
    }
  }

  return (
    <View style={[styles.banner, connected ? styles.connected : styles.disconnected]}>
      <Ionicons
        name={connected ? 'cloud-done-outline' : 'cloud-offline-outline'}
        size={14}
        color={connected ? '#3fb950' : '#f85149'}
      />
      <Text style={[styles.text, connected ? styles.connectedText : styles.disconnectedText]}>
        {connected ? `已连接 · ${modeLabel()}` : '未连接 · 请在设置中配置连接'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 6 },
  connected: { backgroundColor: 'rgba(63,185,80,0.08)' },
  disconnected: { backgroundColor: 'rgba(248,81,73,0.08)' },
  text: { fontSize: 12 },
  connectedText: { color: '#3fb950' },
  disconnectedText: { color: '#f85149' },
});
