// 反馈页
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from '../../components/ui';
import { api } from '../../services/api';
import { useAppStore } from '../../stores/app-store';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

export default function FeedbackScreen({ navigation }: any) {
  const { activeSessionId } = useAppStore();
  const [desc, setDesc] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!desc.trim()) { Alert.alert('提示', '请描述你的问题或建议'); return; }
    setLoading(true);
    try {
      const res = await api.submitFeedback({ description: desc, email, sessionId: activeSessionId || undefined });
      if (res.ok) { Alert.alert('提交成功', '感谢你提供反馈'); navigation.goBack(); }
      else Alert.alert('提交失败', res.error || '请重试');
    } catch { Alert.alert('网络错误'); }
    setLoading(false);
  }

  return (
    <View style={s.c}>
      <View style={s.hd}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <Text style={s.t}>反馈</Text>
      </View>
      <ScrollView contentContainerStyle={s.sc} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>问题描述</Text>
        <TextInput style={s.textarea} placeholder="请描述你的问题或对 Qoder 的改进建议" placeholderTextColor={Colors.dark.textTertiary}
          value={desc} onChangeText={setDesc} multiline numberOfLines={5} textAlignVertical="top" />
        <Text style={s.label}>邮箱（选填）</Text>
        <TextInput style={s.input} placeholder="便于我们联系你" placeholderTextColor={Colors.dark.textTertiary}
          value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        {activeSessionId && (
          <Card style={{ marginBottom: 20 }}>
            <Text style={s.sid}>会话 ID: {activeSessionId}</Text>
          </Card>
        )}
        <Button title="提交反馈" size="lg" fullWidth loading={loading} onPress={handleSubmit} />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  hd: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 48, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  t: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600' },
  sc: { padding: 20 },
  label: { color: Colors.dark.textSecondary, fontSize: FS.sm, fontWeight: '500', marginBottom: 8, marginTop: 16 },
  textarea: { backgroundColor: Colors.dark.surface, borderRadius: BR.md, borderWidth: 1, borderColor: Colors.dark.border, color: Colors.dark.text, fontSize: FS.md, padding: 14, minHeight: 120, lineHeight: 22 },
  input: { backgroundColor: Colors.dark.surface, borderRadius: BR.md, borderWidth: 1, borderColor: Colors.dark.border, color: Colors.dark.text, fontSize: FS.md, padding: 14, marginBottom: 16 },
  sid: { color: Colors.dark.textTertiary, fontSize: FS.xs },
});
