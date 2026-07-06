// 设置页
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { api, UpdateInfo } from '../services/api';
import { useAppStore } from '../stores/app-store';

// Connection URLs - import from shared constants
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS, FRP_RELAY_URL, FRP_RELAY_WS } from '../constants';

export default function SettingsScreen() {
  const { status, setStatus, connected, mode, baseUrl, token, setToken, lanIp, setLanIp, setConnection, user, setUser, logout, updateInfo, setUpdateInfo } = useAppStore();
  const navigation = useNavigation<any>();
  const [editingToken, setEditingToken] = useState(token);
  const [editingIp, setEditingIp] = useState(lanIp);
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const appVersion = Constants.expoConfig?.version || Constants.manifest?.version || '?';

  useEffect(() => {
    loadStatus();
  }, [baseUrl, token]);

  async function loadStatus() {
    try {
      const s = await api.getStatus();
      setStatus(s);
    } catch { /* offline */ }
  }

  function handleSave() {
    setToken(editingToken);
    setLanIp(editingIp);
    // Reconnect — try LAN, then FRP relay, then stay offline
    const tokenStr = editingToken.trim();
    const ipStr = editingIp.trim();
    if (!tokenStr || !ipStr) {
      Alert.alert('提示', '请输入配对 Token 和桌面 IP');
      return;
    }

    // Try LAN direct
    const lanUrl = `http://${ipStr}:3001`;
    api.configure({ baseUrl: lanUrl, token: tokenStr, wsUrl: `ws://${ipStr}:3001/ws` });
    api.connectWs();
    fetch(`${lanUrl}/api/status`, {
      headers: { Authorization: `Bearer ${tokenStr}` },
    }).then(async res => {
      if (res.ok) {
        setConnection(true, 'lan', lanUrl);
        try { const s = await api.getStatus(); setStatus(s); } catch {}
        return;
      }
      throw new Error('LAN failed');
    }).catch(async () => {
      // Try FRP relay (cloud tunnel to desktop web-server)
      api.configure({ baseUrl: FRP_RELAY_URL, token: tokenStr, wsUrl: FRP_RELAY_WS });
      api.connectWs();
      try {
        const frpRes = await fetch(`${FRP_RELAY_URL}/api/sessions?limit=1`, {
          headers: { Authorization: `Bearer ${tokenStr}` },
        });
        if (frpRes.ok) {
          setConnection(true, 'cloud', FRP_RELAY_URL);
          return;
        }
      } catch {}
      // Both failed — stay offline, notify user
      setConnection(false, 'lan', '');
      Alert.alert('连接失败', '无法连接到桌面端。\n请确保：\n1. 桌面端已启动并开启 Web Server\n2. 手机和桌面在同一 WiFi\n3. 配对 Token 正确');
    });
  }

  /** Cloud account login handler */
  async function handleCloudLogin() {
    if (!cloudEmail || !cloudPassword) { setCloudError('请输入用户名和密码'); return; }
    setCloudLoading(true);
    setCloudError('');
    try {
      const result = await api.login(cloudEmail, cloudPassword);
      if (result.ok) {
        const cloudUser = api.cloudUser;
        if (cloudUser) {
          setUser({ id: cloudUser.id, username: cloudUser.username, email: cloudUser.email });
          setCloudPassword('');
          // Switch to cloud account mode (URL must match App.tsx CLOUD_SERVER_URL)
          const cloudUrl = 'https://www.spiritrealmz.com';
          api.configure({ baseUrl: cloudUrl, token: api.jwtToken || '', wsUrl: 'wss://www.spiritrealmz.com/ws' });
          api.connectWs();
          setConnection(true, 'cloud_account', cloudUrl);
        }
      } else {
        setCloudError(result.error || '登录失败');
      }
    } catch (err: any) {
      setCloudError(err.message || '登录失败');
    } finally {
      setCloudLoading(false);
    }
  }

  function handleLogout() {
    Alert.alert('退出登录', '确定退出当前账号？', [
      { text: '取消', style: 'cancel' },
      { text: '退出', style: 'destructive', onPress: () => {
        api.cloudLogout().catch(() => {});
        logout();
      }},
    ]);
  }

  async function handleCheckUpdate() {
    setCheckingUpdate(true);
    setUpdateInfo(null);
    try {
      const info = await api.checkForUpdates(appVersion);
      if (!info) {
        Alert.alert('检查更新', '无法获取版本信息，请检查网络连接');
        return;
      }
      setUpdateInfo(info);
      if (!info.hasUpdate) {
        Alert.alert('检查更新', '当前已是最新版本');
      }
    } catch {
      Alert.alert('检查更新', '检查失败，请稍后重试');
    } finally {
      setCheckingUpdate(false);
    }
  }

  function handleDownload() {
    if (updateInfo?.downloadUrl) {
      Linking.openURL(updateInfo.downloadUrl).catch(() => {
        Alert.alert('下载失败', '无法打开下载链接');
      });
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info (cloud account mode) */}
      {user && mode === 'cloud_account' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>账号信息</Text>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color="#58a6ff" />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.username}</Text>
              <Text style={styles.userEmail}>{user.email || '未设置邮箱'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.subManageBtn} onPress={() => navigation.navigate('Subscription')}>
            <Ionicons name="card-outline" size={16} color="#58a6ff" />
            <Text style={styles.subManageText}>订阅管理</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={16} color="#f85149" />
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Cloud Account Login */}
      {!user && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔐 云账号登录</Text>
          <TextInput
            style={styles.input}
            value={cloudEmail}
            onChangeText={setCloudEmail}
            placeholder="用户名 / 邮箱"
            placeholderTextColor="#484f58"
            autoCapitalize="none"
            editable={!cloudLoading}
          />
          <TextInput
            style={styles.input}
            value={cloudPassword}
            onChangeText={setCloudPassword}
            placeholder="密码"
            placeholderTextColor="#484f58"
            secureTextEntry
            editable={!cloudLoading}
          />
          {cloudError ? (
            <Text style={{ color: '#f85149', fontSize: 12, marginTop: 4 }}>{cloudError}</Text>
          ) : null}
          <TouchableOpacity style={[styles.btn, cloudLoading && { opacity: 0.5 }]} onPress={handleCloudLogin} disabled={cloudLoading}>
            <Text style={styles.btnText}>{cloudLoading ? '登录中...' : '登录云账号'}</Text>
          </TouchableOpacity>
          <Text style={{ color: '#484f58', fontSize: 10, marginTop: 8, lineHeight: 14 }}>
            登录后将自动注册本机设备，支持桌面-移动端云端通信。
          </Text>
        </View>
      )}

      {/* Connection Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>连接状态</Text>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: connected ? '#3fb950' : '#f85149' }]} />
          <Text style={styles.rowLabel}>
            {connected
              ? `已连接 (${mode === 'lan' ? 'LAN直连' : mode === 'cloud' ? 'Cloud中转' : '云账号'})`
              : '未连接'}
          </Text>
        </View>
        {connected && (
          <Text style={styles.subtext}>{baseUrl}</Text>
        )}
      </View>

      {/* Device Info - with defensive checks for missing fields (cloud-server /api/status uses minimal format) */}
      {status && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>设备信息</Text>
          <InfoRow icon="hardware-chip-outline" label="设备" value={`${status.device || 'Unknown'} (${status.platform || '?'})`} />
          <InfoRow icon="time-outline" label="运行时间" value={formatUptime(status.uptime)} />
          <InfoRow icon="server-outline" label="内存"
            value={status.memory ? `${status.memory.free || '?'}MB / ${status.memory.total || '?'}MB 可用` : '未知'} />
          <InfoRow icon="speedometer-outline" label="CPU" value={status.cpu || '未知'} />
          <InfoRow icon="code-slash" label="版本" value={`v${status.version || '?'}`} />
          <View style={styles.divider} />
          {status.stats ? (
            <>
              <InfoRow icon="chatbubbles" label="对话数" value={`${status.stats.conversations ?? '?'}`} />
              <InfoRow icon="checkmark-circle" label="任务数" value={`${status.stats.quest_tasks ?? '?'}`} />
              <InfoRow icon="map" label="计划数" value={`${status.stats.plans ?? '?'}`} />
              <InfoRow icon="phone-portrait" label="移动端" value={`${status.stats.mobile_clients ?? '?'} 台在线`} />
            </>
          ) : null}
        </View>
      )}

      {/* 连接设置 - 云账号已连接则自动隐藏 */}
      {mode !== 'cloud_account' && (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>连接设置</Text>
        <Text style={styles.label}>配对 Token</Text>
        <TextInput
          style={styles.input}
          value={editingToken}
          onChangeText={setEditingToken}
          placeholder="输入桌面显示的 Token"
          placeholderTextColor="#484f58"
          autoCapitalize="none"
        />
        <Text style={styles.label}>桌面 IP 地址</Text>
        <TextInput
          style={styles.input}
          value={editingIp}
          onChangeText={setEditingIp}
          placeholder="192.168.1.x"
          placeholderTextColor="#484f58"
          keyboardType="numeric"
        />
        <TouchableOpacity style={styles.btn} onPress={handleSave}>
          <Text style={styles.btnText}>保存并重新连接</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Version Check */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>版本信息</Text>
        <InfoRow icon="logo-android" label="当前版本" value={`v${appVersion}`} />
        <TouchableOpacity
          style={[styles.checkUpdateBtn, checkingUpdate && { opacity: 0.5 }]}
          onPress={handleCheckUpdate}
          disabled={checkingUpdate}
        >
          <Ionicons name="cloud-download-outline" size={16} color="#fff" />
          <Text style={styles.btnText}>{checkingUpdate ? '检查中...' : '检查更新'}</Text>
        </TouchableOpacity>
        {updateInfo && updateInfo.hasUpdate && (
          <View style={styles.updateCard}>
            <View style={styles.updateHeader}>
              <Ionicons name="arrow-up-circle" size={18} color="#3fb950" />
              <Text style={styles.updateVersion}>发现新版本 v{updateInfo.version}</Text>
            </View>
            {updateInfo.releaseNotes ? (
              <Text style={styles.updateNotes}>{updateInfo.releaseNotes}</Text>
            ) : null}
            {updateInfo.downloadUrl && (
              <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
                <Ionicons name="download-outline" size={16} color="#fff" />
                <Text style={styles.downloadBtnText}>
                  下载安装包{updateInfo.fileSize ? ` (${(updateInfo.fileSize / 1024 / 1024).toFixed(1)}MB)` : ''}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Refresh */}
      <TouchableOpacity style={styles.btnOutline} onPress={loadStatus}>
        <Ionicons name="refresh" size={16} color="#58a6ff" />
        <Text style={styles.btnOutlineText}>刷新状态</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color="#8b949e" style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatUptime(seconds: number): string {
  if (seconds == null || isNaN(seconds)) return '未知';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}天 ${h % 24}小时`;
  return `${h}小时 ${m}分钟`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 16 },
  card: {
    backgroundColor: '#161b22', borderRadius: 8, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#21262d',
  },
  cardTitle: { color: '#58a6ff', fontSize: 13, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  rowLabel: { color: '#c9d1d9', fontSize: 15 },
  subtext: { color: '#484f58', fontSize: 12, marginTop: 4, marginLeft: 18 },
  divider: { height: 1, backgroundColor: '#21262d', marginVertical: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  infoIcon: { marginRight: 8 },
  infoLabel: { color: '#8b949e', fontSize: 13, flex: 1 },
  infoValue: { color: '#c9d1d9', fontSize: 13 },
  label: { color: '#8b949e', fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: '#0d1117', color: '#c9d1d9', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#30363d' },
  btn: { backgroundColor: '#1f6feb', borderRadius: 6, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  btnOutline: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, gap: 8 },
  btnOutlineText: { color: '#58a6ff', fontSize: 14 },
  // User info
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(88,166,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  userInfo: { flex: 1 },
  userName: { color: '#c9d1d9', fontSize: 16, fontWeight: '600' },
  userEmail: { color: '#8b949e', fontSize: 13, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 6,
    backgroundColor: 'rgba(248,81,73,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,81,73,0.2)',
  },
  logoutText: { color: '#f85149', fontSize: 14, fontWeight: '500' },
  subManageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 6, marginBottom: 8,
    backgroundColor: 'rgba(88,166,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(88,166,255,0.2)',
  },
  subManageText: { color: '#58a6ff', fontSize: 14, fontWeight: '500' },
  checkUpdateBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, backgroundColor: '#1f6feb', borderRadius: 6, paddingVertical: 12, marginTop: 10,
  },
  updateCard: {
    backgroundColor: 'rgba(63,185,80,0.06)',
    borderWidth: 1, borderColor: 'rgba(63,185,80,0.2)',
    borderRadius: 6, padding: 10, marginTop: 10,
  },
  updateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  updateVersion: { color: '#3fb950', fontSize: 14, fontWeight: '600' },
  updateNotes: { color: '#8b949e', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 8, borderRadius: 6,
    backgroundColor: '#238636',
  },
  downloadBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
});
