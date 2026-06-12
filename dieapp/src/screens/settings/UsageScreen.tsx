// 用量与账单
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/ui';
import { api } from '../../services/api';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

export default function UsageScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => { loadUsage(); }, []);
  async function loadUsage() {
    try { const res = await api.getUsage(); if (res.ok && res.data) setUsage(res.data); } catch {}
    setLoading(false);
  }

  const used = usage?.used || 45, total = usage?.total || 300, pct = Math.round((used / total) * 100);

  return (
    <View style={s.c}>
      <View style={s.hd}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <Text style={s.t}>用量与账单</Text>
      </View>
      <ScrollView contentContainerStyle={s.sc}>
        {loading ? <ActivityIndicator size="large" color={Colors.dark.primary} style={{ marginTop: 40 }} /> : (
          <>
            <View style={s.circleCard}>
              <Text style={s.circlePct}>{pct}%</Text>
              <Text style={s.circleLabel}>已使用</Text>
            </View>
            <Card style={{ marginBottom: 16 }}>
              <View style={s.r}><Text style={s.rl}>计划额度</Text><Text style={s.rv}>{total} 额度</Text></View>
              <View style={s.r}><Text style={s.rl}>已用</Text><Text style={[s.rv, { color: Colors.dark.warning }]}>{used} 额度</Text></View>
              <View style={s.r}><Text style={s.rl}>剩余</Text><Text style={[s.rv, { color: Colors.dark.success }]}>{total - used} 额度</Text></View>
              {usage?.renewsOn && (
                <View style={s.r}><Text style={s.rl}>续期于</Text><Text style={s.rv}>{usage.renewsOn}</Text></View>
              )}
            </Card>
            {/* 进度条 */}
            <View style={s.progressBg}><View style={[s.progressFill, { width: `${pct}%` as any }]} /></View>
            <Text style={s.progressText}>{used} / {total}（已用 {pct}%）</Text>
          </>
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
  circleCard: { backgroundColor: Colors.dark.surface, borderRadius: 80, width: 160, height: 160, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: Colors.dark.primary, marginBottom: 24 },
  circlePct: { color: Colors.dark.primary, fontSize: 40, fontWeight: '800' },
  circleLabel: { color: Colors.dark.textSecondary, fontSize: FS.sm, marginTop: 4 },
  r: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  rl: { color: Colors.dark.textSecondary, fontSize: FS.sm }, rv: { color: Colors.dark.text, fontSize: FS.sm, fontWeight: '600' },
  progressBg: { height: 8, backgroundColor: Colors.dark.surface2, borderRadius: 4, marginTop: 8, marginBottom: 8 },
  progressFill: { height: 8, backgroundColor: Colors.dark.primary, borderRadius: 4 },
  progressText: { color: Colors.dark.textTertiary, fontSize: FS.xs, textAlign: 'center' },
});
