// 通知设置
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../stores/app-store';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

const ITEMS = [
  { key: 'system' as const, label: '系统通知', desc: '当有新消息到达时，您将在主屏幕收到通知', icon: 'notifications' },
  { key: 'taskUpdates' as const, label: '任务更新', desc: '任务状态变更时通知你', icon: 'refresh' },
  { key: 'approval' as const, label: '审批请求', desc: 'Agent 执行操作前需要你授权', icon: 'checkmark-circle' },
  { key: 'planReview' as const, label: '计划审查', desc: '在代理执行前审查计划', icon: 'map' },
  { key: 'qa' as const, label: '问答', desc: '回复代理的实时查询', icon: 'help-circle' },
  { key: 'taskCompleted' as const, label: '运行完成', desc: '任务完成时通知你', icon: 'flag' },
];

export default function NotificationsScreen({ navigation }: any) {
  const { notificationSettings, setNotificationSetting } = useAppStore();

  return (
    <View style={s.c}>
      <View style={s.hd}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={Colors.dark.text} /></TouchableOpacity>
        <Text style={s.t}>通知</Text>
      </View>
      <View style={s.sc}>
        {ITEMS.map(item => (
          <View key={item.key} style={s.row}>
            <Ionicons name={item.icon as any} size={22} color={Colors.dark.textSecondary} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.l}>{item.label}</Text>
              <Text style={s.d}>{item.desc}</Text>
            </View>
            <Switch value={notificationSettings[item.key]} onValueChange={v => setNotificationSetting(item.key, v)} trackColor={{ true: Colors.dark.primary }} />
          </View>
        ))}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  hd: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 48, gap: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  t: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600' },
  sc: { padding: 20, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, padding: 16 },
  l: { color: Colors.dark.text, fontSize: FS.md, fontWeight: '500', marginBottom: 2 },
  d: { color: Colors.dark.textTertiary, fontSize: FS.xs },
});
