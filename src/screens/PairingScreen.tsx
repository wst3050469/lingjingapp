// 设备配对页 — 首次启动时显示
// v1.0.2: 统一使用 FRP_RELAY_URL 中转域名，Token 验证需经 /api/status
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore } from '../stores/app-store';

// 与 App.tsx 保持一致的连接常量
const FRP_RELAY_URL = 'https://wap.zhejiangjinmo.com';
const FRP_RELAY_WS = 'wss://wap.zhejiangjinmo.com/ws';

type ChannelAttempt = 'idle' | 'trying' | 'success' | 'failed';

export default function PairingScreen({ onSuccess, onSwitchToLogin }: { onSuccess?: (token: string, ip: string) => void; onSwitchToLogin?: () => void }) {
  const { token, setToken, lanIp, setLanIp, setConnection } = useAppStore();
  const [editingToken, setEditingToken] = useState(token);
  const [editingIp, setEditingIp] = useState(lanIp || '');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState<'token' | 'connecting' | 'done'>('token');

  // Channel attempt states for visual feedback
  const [lanAttempt, setLanAttempt] = useState<ChannelAttempt>('idle');
  const [cloudAttempt, setCloudAttempt] = useState<ChannelAttempt>('idle');
  const [connectedChannel, setConnectedChannel] = useState<'' | 'lan' | 'cloud'>('');

  async function handlePair() {
    if (!editingToken.trim() || !editingIp.trim()) return;

    setStatus('connecting');
    setErrorMsg('');
    setStep('connecting');
    setLanAttempt('idle');
    setCloudAttempt('idle');
    setConnectedChannel('');

    const tokenStr = editingToken.trim();
    const ipStr = editingIp.trim();

    // ── Channel 1: LAN ──
    setLanAttempt('trying');
    const lanUrl = `http://${ipStr}:3001`;
    try {
      api.configure({ baseUrl: lanUrl, token: tokenStr, wsUrl: `ws://${ipStr}:3001/ws` });
      const res = await fetch(`${lanUrl}/api/status`, {
        headers: { Authorization: `Bearer ${tokenStr}` },
      });
      if (res.ok) {
        setLanAttempt('success');
        setConnectedChannel('lan');
        setToken(tokenStr);
        setLanIp(ipStr);
        api.connectWs();
        setConnection(true, 'lan', lanUrl);
        setStatus('success');
        setStep('done');
        return;
      }
    } catch { /* will try cloud */ }
    setLanAttempt('failed');

    // ── Channel 2: FRP Relay (cloud tunnel to desktop) ──
    setCloudAttempt('trying');
    try {
      api.configure({ baseUrl: FRP_RELAY_URL, token: tokenStr, wsUrl: FRP_RELAY_WS });
      // Use authenticated endpoint to verify token works with desktop web-server
      const res = await fetch(`${FRP_RELAY_URL}/api/sessions?limit=1`, {
        headers: { Authorization: `Bearer ${tokenStr}` },
      });
      if (res.ok) {
        setCloudAttempt('success');
        setConnectedChannel('cloud');
        setToken(tokenStr);
        setLanIp(ipStr);
        api.connectWs();
        setConnection(true, 'cloud', FRP_RELAY_URL);
        setStatus('success');
        setStep('done');
        return;
      }
    } catch { /* all failed */ }
    setCloudAttempt('failed');

    setStatus('failed');
    setErrorMsg('所有通道均连接失败\n\n📡 LAN: 同WiFi直连\n☁️ FRP中转: 通过云服务器连接桌面端\n\n请检查桌面端是否已启动并开启 Web Server');
    setStep('token');
  }

  useEffect(() => {
    if (step === 'done') {
      const timer = setTimeout(() => {
        onSuccess?.(editingToken.trim(), editingIp.trim());
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [step, editingToken, editingIp, onSuccess]);

  // ── Success view ──
  if (step === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="checkmark-circle" size={80} color="#3fb950" />
          <Text style={styles.successTitle}>配对成功！</Text>
          <Text style={styles.successSub}>
            {connectedChannel === 'lan' ? '已通过局域网连接' :
             '已通过FRP中转连接'}
          </Text>
          <Text style={styles.successUrl}>
            {connectedChannel === 'lan' ? `${editingIp}:3001` : 'lingjing.zhejiangjinmo.com'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Channel status icon helper ──
  function channelIcon(attempt: ChannelAttempt) {
    switch (attempt) {
      case 'trying': return <ActivityIndicator size="small" color="#58a6ff" />;
      case 'success': return <Ionicons name="checkmark-circle" size={18} color="#3fb950" />;
      case 'failed': return <Ionicons name="close-circle" size={18} color="#f85149" />;
      default: return <Ionicons name="ellipse-outline" size={18} color="#30363d" />;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="link" size={48} color="#58a6ff" />
          <Text style={styles.title}>连接灵境桌面端</Text>
          <Text style={styles.subtitle}>
            在桌面端「灵境」→ 设置 → 移动端 获取配对 Token
          </Text>
        </View>

        {/* Token Input */}
        <View style={styles.card}>
          <Text style={styles.label}>配对 Token</Text>
          <TextInput
            style={styles.input}
            value={editingToken}
            onChangeText={setEditingToken}
            placeholder="粘贴桌面端显示的 Token"
            placeholderTextColor="#484f58"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* IP Input */}
        <View style={styles.card}>
          <Text style={styles.label}>桌面端 IP 地址</Text>
          <TextInput
            style={styles.input}
            value={editingIp}
            onChangeText={setEditingIp}
            placeholder="例如 192.168.1.9"
            placeholderTextColor="#484f58"
            keyboardType="numeric"
          />
        </View>

        {/* Channel attempt status (only visible during connecting) */}
        {status === 'connecting' && (
          <View style={styles.channelsCard}>
            <Text style={styles.channelsTitle}>正在尝试连接...</Text>
            <View style={styles.channelRow}>
              {channelIcon(lanAttempt)}
              <Text style={[styles.channelText, lanAttempt === 'trying' && styles.channelActive]}>
                📡 局域网直连
              </Text>
            </View>
            <View style={styles.channelRow}>
              {channelIcon(cloudAttempt)}
              <Text style={[styles.channelText, cloudAttempt === 'trying' && styles.channelActive]}>
                ☁️ FRP 中转（远程连接）
              </Text>
            </View>
          </View>
        )}

        {/* 连接说明 */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={16} color="#58a6ff" />
            <Text style={styles.infoTitle}>连接方式</Text>
          </View>
          <Text style={styles.infoText}>
            📡 局域网：手机和桌面端在同 WiFi 下自动连接
          </Text>
          <Text style={styles.infoText}>
            ☁️ FRP 中转：通过 lingjing.zhejiangjinmo.com 远程连接（需桌面端开启FRP）
          </Text>
          <Text style={styles.infoHint}>
            提示：桌面设置→移动端→开启「灵境移动端」开关即可
          </Text>
        </View>

        {/* Error */}
        {status === 'failed' && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#f85149" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Connect Button */}
        <TouchableOpacity
          style={[styles.button, (status === 'connecting' || !editingToken.trim()) && styles.buttonDisabled]}
          onPress={handlePair}
          disabled={status === 'connecting' || !editingToken.trim()}
        >
          {status === 'connecting' ? (
            <View style={styles.buttonLoading}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.buttonText}>  连接中...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>连接桌面端</Text>
          )}
        </TouchableOpacity>

        {/* Skip */}
        <TouchableOpacity style={styles.skipBtn} onPress={() => onSuccess?.('', '')}>
          <Text style={styles.skipText}>跳过，稍后设置</Text>
        </TouchableOpacity>

        {/* Switch to cloud login */}
        {onSwitchToLogin && (
          <TouchableOpacity style={styles.switchBtn} onPress={onSwitchToLogin}>
            <Ionicons name="cloud-outline" size={14} color="#8b949e" />
            <Text style={styles.switchText}>云账号登录</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center', maxWidth: 400, alignSelf: 'center', width: '100%' },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 28 },
  title: { color: '#c9d1d9', fontSize: 22, fontWeight: '700', marginTop: 12 },
  subtitle: { color: '#8b949e', fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  successTitle: { color: '#3fb950', fontSize: 22, fontWeight: '700', marginTop: 16 },
  successSub: { color: '#8b949e', fontSize: 14, marginTop: 4 },
  successUrl: { color: '#58a6ff', fontSize: 13, marginTop: 8, fontFamily: 'monospace' },
  card: { marginBottom: 14 },
  label: { color: '#8b949e', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#161b22', color: '#c9d1d9', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#30363d',
  },
  // Channel attempt status
  channelsCard: {
    backgroundColor: '#161b22', borderRadius: 8, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: '#21262d',
  },
  channelsTitle: { color: '#8b949e', fontSize: 11, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  channelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  channelText: { color: '#8b949e', fontSize: 13 },
  channelActive: { color: '#58a6ff' },
  // FRP info card
  infoCard: {
    backgroundColor: 'rgba(88,166,255,0.06)', borderRadius: 8, padding: 14, marginBottom: 18,
    borderWidth: 1, borderColor: 'rgba(88,166,255,0.15)',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoTitle: { color: '#58a6ff', fontSize: 13, fontWeight: '600' },
  infoText: { color: '#8b949e', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  infoHint: { color: '#484f58', fontSize: 11, fontStyle: 'italic' },
  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(248,81,73,0.1)', borderRadius: 8,
    padding: 12, marginBottom: 16,
  },
  errorText: { color: '#f85149', fontSize: 13, flex: 1, lineHeight: 20 },
  // Buttons
  button: {
    backgroundColor: '#1f6feb', borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonLoading: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skipBtn: { alignItems: 'center', marginTop: 20, padding: 8 },
  skipText: { color: '#484f58', fontSize: 14 },
  switchBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 12 },
  switchText: { color: '#8b949e', fontSize: 13 },
});
