// 账号与安全 - 注销账号流程
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui';
import { api } from '../../services/api';
import { useAppStore, clearPersistedAuth } from '../../stores/app-store';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

export default function AccountSecurityScreen({ navigation }: any) {
  const { user, clearAuth } = useAppStore();
  const [step, setStep] = useState<'confirm' | 'verify' | 'deleting'>('confirm');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendCode() {
    setLoading(true); setError('');
    try { const res = await api.sendDeleteAccountCode(); if (res.ok) setStep('verify'); else setError(res.error || '发送失败'); }
    catch { setError('网络错误'); }
    setLoading(false);
  }

  async function handleDelete() {
    if (!code.trim()) { setError('请输入验证码'); return; }
    setLoading(true);
    try {
      const res = await api.deleteAccount(code);
      if (res.ok) { await clearPersistedAuth(); clearAuth(); }
      else setError(res.error || '注销失败');
    } catch { setError('网络错误'); }
    setLoading(false);
  }

  return (
    <View style={s.c}>
      <View style={s.hd}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <Text style={s.t}>账号与安全</Text>
      </View>
      <ScrollView contentContainerStyle={s.sc}>
        <View style={s.card}>
          <Text style={s.label}>账号</Text>
          <Text style={s.val}>{user?.username || user?.email || '未设置'}</Text>
        </View>

        {step === 'confirm' && (
          <View style={s.section}>
            <Ionicons name="warning" size={48} color={Colors.dark.danger} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={s.warnTitle}>注销账号</Text>
            <Text style={s.warnDesc}>确定要注销你的账号吗？此操作不可撤销，所有数据将被永久删除。</Text>
            <Button title="发送验证码" variant="danger" fullWidth loading={loading} onPress={handleSendCode} style={{ marginTop: 20 }} />
          </View>
        )}

        {step === 'verify' && (
          <View style={s.section}>
            <Text style={s.verifyTitle}>验证身份</Text>
            <Text style={s.verifyDesc}>我们已向你的邮箱发送了验证码，请在下方输入以确认注销账号。</Text>
            <TextInput style={s.input} placeholder="请输入验证码" placeholderTextColor={Colors.dark.textTertiary}
              value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
            {error ? <Text style={s.e}>{error}</Text> : null}
            <Button title="验证并注销" variant="danger" fullWidth loading={loading} onPress={handleDelete} />
            <TouchableOpacity onPress={handleSendCode} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: Colors.dark.primary, fontSize: FS.sm }}>重新发送验证码</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  hd: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 48, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  t: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600' },
  sc: { padding: 20 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, padding: 16, marginBottom: 24 },
  label: { color: Colors.dark.textSecondary, fontSize: FS.xs, marginBottom: 4 },
  val: { color: Colors.dark.text, fontSize: FS.md, fontWeight: '500' },
  section: { backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, padding: 24 },
  warnTitle: { color: Colors.dark.danger, fontSize: FS.xl, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  warnDesc: { color: Colors.dark.textSecondary, fontSize: FS.sm, lineHeight: 22, textAlign: 'center' },
  verifyTitle: { color: Colors.dark.text, fontSize: FS.xl, fontWeight: '700', marginBottom: 8 },
  verifyDesc: { color: Colors.dark.textSecondary, fontSize: FS.sm, lineHeight: 22, marginBottom: 20 },
  input: { backgroundColor: Colors.dark.bg, borderRadius: BR.md, borderWidth: 1, borderColor: Colors.dark.border, color: Colors.dark.text, fontSize: FS.lg, padding: 14, marginBottom: 12, textAlign: 'center' },
  e: { color: Colors.dark.danger, fontSize: FS.sm, marginBottom: 12 },
});
