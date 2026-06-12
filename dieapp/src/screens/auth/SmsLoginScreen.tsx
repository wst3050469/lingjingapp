// 短信登录
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui';
import { api } from '../../services/api';
import { useAppStore, savePersistedAuth } from '../../stores/app-store';
import { CLOUD_SERVER_URL, CLOUD_SERVER_WS, Colors, FontSize as FS } from '../../constants';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'SmsLogin'> & { onLoginSuccess: () => void };

export default function SmsLoginScreen({ navigation, onLoginSuccess }: Props) {
  const { setAuth, setConnection } = useAppStore();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const refs = useRef<(TextInput | null)[]>([]);

  useEffect(() => { if (countdown > 0) { const t = setTimeout(() => setCountdown(c => c - 1), 1000); return () => clearTimeout(t); } }, [countdown]);

  async function handleSendCode() {
    setError(''); if (!/^1\d{10}$/.test(phone)) { setError('请输入正确的手机号'); return; }
    setLoading(true);
    try { const res = await api.sendSmsCode(phone); if (res.ok) { setStep('code'); setCountdown(60); } else setError(res.error || '发送失败'); } catch { setError('网络错误'); }
    setLoading(false);
  }
  function handleInput(t: string, i: number) { const n = [...code]; n[i] = t.slice(-1); setCode(n); if (t && i < 5) refs.current[i + 1]?.focus(); if (n.every(c => c)) doLogin(n.join('')); }
  async function doLogin(c: string) {
    setLoading(true);
    try {
      const res = await api.smsLogin(phone, c);
      if (res.ok && res.data?.token) { api.configure({ baseUrl: CLOUD_SERVER_URL, token: res.data.token, wsUrl: CLOUD_SERVER_WS }); setAuth(res.data.user?.id || phone, res.data.token); await savePersistedAuth(res.data.token, res.data.user); setConnection(true, 'cloud_account', CLOUD_SERVER_URL); api.connectWs(); onLoginSuccess(); }
      else { setError(res.error || '验证码错误'); setCode(['', '', '', '', '', '']); refs.current[0]?.focus(); }
    } catch { setError('网络错误'); }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.sc} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => step === 'phone' ? navigation.goBack() : setStep('phone')} style={s.bk}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <Text style={s.t}>手机号登录</Text><Text style={s.st}>{step === 'phone' ? '输入手机号获取验证码' : `验证码已发送至 +86 ${phone}`}</Text>
        {step === 'phone' ? (
          <>
            <View style={s.pr}><View style={s.px}><Text style={s.pt}>+86</Text></View><TextInput style={s.pi} placeholder="请输入手机号" placeholderTextColor={Colors.dark.textTertiary} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={11} /></View>
            {error ? <Text style={s.e}>{error}</Text> : null}
            <Button title="获取验证码" size="lg" fullWidth loading={loading} onPress={handleSendCode} />
          </>
        ) : (
          <>
            <Text style={s.cl}>输入6位验证码</Text>
            <View style={s.cr}>{code.map((c, i) => (<TextInput key={i} ref={r => { refs.current[i] = r; }} style={[s.cb, c ? s.cbf : null]} value={c} onChangeText={t => handleInput(t, i)} keyboardType="number-pad" maxLength={1} selectTextOnFocus />))}</View>
            {error ? <Text style={s.e}>{error}</Text> : null}
            <Button title="确认登录" size="lg" fullWidth loading={loading} onPress={() => doLogin(code.join(''))} />
            <TouchableOpacity onPress={handleSendCode} disabled={countdown > 0} style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: countdown > 0 ? Colors.dark.textTertiary : Colors.dark.primary, fontSize: FS.sm }}>{countdown > 0 ? `重新获取（${countdown}s）` : '重新获取'}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg }, sc: { flexGrow: 1, padding: 24 }, bk: { marginTop: 8, marginBottom: 24, width: 40, height: 40, justifyContent: 'center' },
  t: { color: Colors.dark.text, fontSize: FS.xxxl, fontWeight: '700', marginBottom: 6 }, st: { color: Colors.dark.textSecondary, fontSize: FS.md, marginBottom: 32 },
  pr: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.dark.border, marginBottom: 16 },
  px: { paddingHorizontal: 14, paddingVertical: 14, borderRightWidth: 1, borderRightColor: Colors.dark.border }, pt: { color: Colors.dark.text, fontSize: FS.md, fontWeight: '500' },
  pi: { flex: 1, color: Colors.dark.text, fontSize: FS.md, paddingHorizontal: 14, height: 48 }, e: { color: Colors.dark.danger, fontSize: FS.sm, marginBottom: 12 },
  cl: { color: Colors.dark.textSecondary, fontSize: FS.sm, marginBottom: 12 }, cr: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 16 },
  cb: { width: 44, height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.dark.border, backgroundColor: Colors.dark.surface, color: Colors.dark.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  cbf: { borderColor: Colors.dark.primary },
});
