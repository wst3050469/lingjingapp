// 云账号登录/注册页
// 支持登录和注册两种模式，使用 cloud-server /api/auth/login + /api/auth/signup
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore } from '../stores/app-store';

type AuthMode = 'login' | 'register';

export default function LoginScreen({ onSuccess, onSwitchToPairing }: { onSuccess?: () => void; onSwitchToPairing?: () => void }) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAppStore((s) => s.setAuth);
  const setUser = useAppStore((s) => s.setUser);

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      setError('用户名和密码不能为空');
      return;
    }
    if (mode === 'register' && password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    setLoading(true);
    setError('');

    // Configure API to use cloud server for auth
    api.configure({ baseUrl: 'https://ide.zhejiangjinmo.com', token: '', wsUrl: 'wss://ide.zhejiangjinmo.com/ws' });

    try {
      const result = mode === 'login'
        ? await api.login(username.trim(), password)
        : await api.signup(username.trim(), password, email.trim() || undefined);

      if (result.ok && result.token) {
        // Save auth + user info to store (persisted to AsyncStorage)
        setAuth(result.user?.id || result.token.slice(0, 8), result.token);
        if (result.user) {
          setUser({
            id: result.user.id,
            username: result.user.username,
            email: result.user.email || '',
            avatar: result.user.avatar,
            registeredAt: result.user.registeredAt,
          });
        }
        onSuccess?.();
      } else {
        // Translate common server errors to user-friendly Chinese messages
        const serverError = result.error || '';
        let friendlyMsg: string;
        if (serverError.includes('invalid_credentials')) {
          friendlyMsg = '用户名或密码错误，请检查后重试';
        } else if (serverError.includes('username_and_password_required')) {
          friendlyMsg = '用户名和密码不能为空';
        } else if (serverError.includes('username_min_2')) {
          friendlyMsg = '用户名至少2个字符';
        } else if (serverError.includes('password_min_6')) {
          friendlyMsg = '密码长度至少6位';
        } else if (serverError.includes('username_exists') || serverError.includes('already_exists')) {
          friendlyMsg = '该用户名已被注册';
        } else if (serverError) {
          friendlyMsg = serverError;
        } else {
          friendlyMsg = mode === 'login' ? '登录失败，请检查用户名和密码' : '注册失败，请稍后重试';
        }
        setError(friendlyMsg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`连接错误: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="code-slash" size={48} color="#58a6ff" />
            </View>
            <Text style={styles.title}>灵境 IDE</Text>
            <Text style={styles.subtitle}>AI 编程助手</Text>
          </View>

          {/* Mode Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => { setMode('login'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>登录</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'register' && styles.tabActive]}
              onPress={() => { setMode('register'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>注册</Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.card}>
            {/* Username */}
            <Text style={styles.label}>用户名</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="输入用户名"
              placeholderTextColor="#484f58"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />

            {/* Email (only for register) */}
            {mode === 'register' && (
              <>
                <Text style={styles.label}>邮箱（选填）</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@example.com"
                  placeholderTextColor="#484f58"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </>
            )}

            {/* Password */}
            <Text style={styles.label}>密码</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'register' ? '至少6位密码' : '输入密码'}
              placeholderTextColor="#484f58"
              secureTextEntry
              editable={!loading}
            />

            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#f85149" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.btn, (loading || !username.trim() || !password.trim()) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={loading || !username.trim() || !password.trim()}
            >
              {loading ? (
                <View style={styles.btnLoading}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.btnText}>  {mode === 'login' ? '登录中...' : '注册中...'}</Text>
                </View>
              ) : (
                <Text style={styles.btnText}>{mode === 'login' ? '登录' : '注册'}</Text>
              )}
            </TouchableOpacity>

            {/* Toggle mode */}
            <TouchableOpacity style={styles.toggleBtn} onPress={toggleMode} disabled={loading}>
              <Text style={styles.toggleText}>
                {mode === 'login' ? '没有账号？点击注册' : '已有账号？点击登录'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cloud info */}
          <View style={styles.infoCard}>
            <Ionicons name="cloud-outline" size={16} color="#58a6ff" />
            <Text style={styles.infoText}>
              通过云账号登录后，可直接使用灵境云服务
            </Text>
          </View>

          {/* Switch to pairing */}
          {onSwitchToPairing && (
            <TouchableOpacity style={styles.switchBtn} onPress={onSwitchToPairing}>
              <Ionicons name="link" size={14} color="#8b949e" />
              <Text style={styles.switchText}>连接桌面端</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center', maxWidth: 400, alignSelf: 'center', width: '100%' },
  // Header
  header: { alignItems: 'center', marginBottom: 28 },
  logoContainer: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: 'rgba(88,166,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  title: { color: '#c9d1d9', fontSize: 24, fontWeight: '700' },
  subtitle: { color: '#8b949e', fontSize: 14, marginTop: 4 },
  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: '#161b22',
    borderRadius: 8, padding: 2, marginBottom: 16,
    borderWidth: 1, borderColor: '#21262d',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: '#1f6feb' },
  tabText: { color: '#8b949e', fontSize: 14, fontWeight: '500' },
  tabTextActive: { color: '#ffffff', fontWeight: '600' },
  // Card
  card: {
    backgroundColor: '#161b22', borderRadius: 8, padding: 16,
    borderWidth: 1, borderColor: '#21262d', marginBottom: 12,
  },
  label: { color: '#8b949e', fontSize: 12, marginTop: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    backgroundColor: '#0d1117', color: '#c9d1d9', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#30363d',
  },
  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: 'rgba(248,81,73,0.1)', borderRadius: 6,
    padding: 10, marginTop: 10,
  },
  errorText: { color: '#f85149', fontSize: 13, flex: 1 },
  // Button
  btn: {
    backgroundColor: '#1f6feb', borderRadius: 6, paddingVertical: 12,
    alignItems: 'center', marginTop: 14,
  },
  btnDisabled: { opacity: 0.5 },
  btnLoading: { flexDirection: 'row', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  toggleBtn: { alignItems: 'center', marginTop: 14, padding: 4 },
  toggleText: { color: '#58a6ff', fontSize: 13 },
  // Info
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(88,166,255,0.06)', borderRadius: 8,
    padding: 12, borderWidth: 1, borderColor: 'rgba(88,166,255,0.15)',
  },
  infoText: { color: '#8b949e', fontSize: 12, flex: 1, lineHeight: 18 },
  switchBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, padding: 12 },
  switchText: { color: '#8b949e', fontSize: 13 },
});
