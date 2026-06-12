// 账密登录
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Input } from '../../components/ui';
import { api } from '../../services/api';
import { useAppStore, savePersistedAuth } from '../../stores/app-store';
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS, Colors, FontSize as FS } from '../../constants';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'> & { onLoginSuccess: () => void };

export default function LoginScreen({ navigation, onLoginSuccess }: Props) {
  const { setAuth, setConnection } = useAppStore();
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState('');

  async function handleLogin() {
    setError(''); if (!username.trim()) { setError('请输入账号'); return; } if (!password) { setError('请输入密码'); return; }
    setLoading(true);
    try {
      const res = await api.login(username.trim(), password);
      if (res.ok && res.data?.token) {
        api.configure({ baseUrl: CLOUD_SERVER_URL, token: res.data.token, wsUrl: CLOUD_SERVER_WS });
        setAuth(res.data.user?.id || username, res.data.token); await savePersistedAuth(res.data.token, res.data.user);
        setConnection(true, 'cloud_account', CLOUD_SERVER_URL); api.connectWs(); onLoginSuccess();
      } else setError(res.error || '账号或密码错误');
    } catch { setError('网络错误，请重试'); }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.sc} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.bk}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <View style={s.hd}><Text style={s.t}>账号登录</Text><Text style={s.st}>输入你的灵境账号和密码</Text></View>
        <Input label="账号" placeholder="邮箱/手机号/用户名" value={username} onChangeText={setUsername} autoCapitalize="none"
          leftIcon={<Ionicons name="person-outline" size={20} color={Colors.dark.textTertiary} />} />
        <Input label="密码" placeholder="输入密码" value={password} onChangeText={setPassword} secureTextEntry={!showPw}
          leftIcon={<Ionicons name="lock-closed-outline" size={20} color={Colors.dark.textTertiary} />}
          rightIcon={<Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.dark.textTertiary} />}
          onRightIconPress={() => setShowPw(!showPw)} />
        {error ? <Text style={s.e}>{error}</Text> : null}
        <Button title="登录" size="lg" fullWidth loading={loading} onPress={handleLogin} style={{ marginTop: 8 }} />
        <TouchableOpacity style={s.fg}><Text style={s.fgt}>忘记密码？</Text></TouchableOpacity>
        <View style={s.dr}><View style={s.dl} /><Text style={s.dt}>或</Text><View style={s.dl} /></View>
        <View style={s.al}>
          <TouchableOpacity style={s.ab} onPress={() => navigation.navigate('SmsLogin')}>
            <Ionicons name="phone-portrait-outline" size={24} color={Colors.dark.primary} /><Text style={s.al2}>手机号登录</Text></TouchableOpacity>
          <TouchableOpacity style={s.ab} onPress={() => navigation.navigate('EnterpriseLogin')}>
            <Ionicons name="business-outline" size={24} color={Colors.dark.purple} /><Text style={s.al2}>企业登录</Text></TouchableOpacity>
        </View>
        <View style={s.sr}><Text style={s.sx}>还没有账号？</Text><TouchableOpacity><Text style={s.sl}>注册</Text></TouchableOpacity></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg }, sc: { flexGrow: 1, padding: 24 }, bk: { marginTop: 8, marginBottom: 20, width: 40, height: 40, justifyContent: 'center' },
  hd: { marginBottom: 32 }, t: { color: Colors.dark.text, fontSize: FS.xxxl, fontWeight: '700', marginBottom: 6 },
  st: { color: Colors.dark.textSecondary, fontSize: FS.md }, e: { color: Colors.dark.danger, fontSize: FS.sm, marginBottom: 12 },
  fg: { alignItems: 'flex-end', marginTop: 12 }, fgt: { color: Colors.dark.primary, fontSize: FS.sm },
  dr: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 }, dl: { flex: 1, height: 1, backgroundColor: Colors.dark.border },
  dt: { color: Colors.dark.textTertiary, fontSize: FS.sm }, al: { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 32 },
  ab: { alignItems: 'center', gap: 6, padding: 12 }, al2: { color: Colors.dark.textSecondary, fontSize: FS.xs },
  sr: { flexDirection: 'row', justifyContent: 'center', gap: 4 }, sx: { color: Colors.dark.textSecondary, fontSize: FS.sm }, sl: { color: Colors.dark.primary, fontSize: FS.sm, fontWeight: '600' },
});
