// 设置页 - 对齐 qoder.apk Settings 设计
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, clearPersistedAuth } from '../../stores/app-store';
import { api } from '../../services/api';
import { Colors, FontSize as FS, BorderRadius as BR, APP_VERSION } from '../../constants';

interface SettingRowProps { icon: string; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; danger?: boolean; }

function SettingRow({ icon, title, subtitle, right, onPress, danger }: SettingRowProps) {
  return (
    <TouchableOpacity style={[s.row, danger && s.rowDanger]} onPress={onPress} activeOpacity={0.7} disabled={!onPress && !right}>
      <Ionicons name={icon as any} size={22} color={danger ? Colors.dark.danger : Colors.dark.textSecondary} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, danger && { color: Colors.dark.danger }]}>{title}</Text>
        {subtitle && <Text style={s.rowSub}>{subtitle}</Text>}
      </View>
      {right || <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, clearAuth, notificationSettings, setNotificationSetting } = useAppStore();
  const [signOutLoading, setSignOutLoading] = useState(false);

  function handleSignOut() {
    Alert.alert('退出登录', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      { text: '退出登录', style: 'destructive', onPress: async () => {
        setSignOutLoading(true);
        await clearPersistedAuth();
        clearAuth();
        api.disconnectWs();
        setSignOutLoading(false);
      }},
    ]);
  }

  function handleCheckUpdate() {
    Alert.alert('版本检查', `当前版本 ${APP_VERSION} 已是最新版本。`);
  }

  return (
    <View style={s.c}>
      <View style={s.header}><Text style={s.hTitle}>设置</Text></View>
      <ScrollView contentContainerStyle={s.sc} showsVerticalScrollIndicator={false}>
        {/* 用户信息 */}
        <TouchableOpacity style={s.profile}>
          <View style={s.avatar}><Text style={s.avatarText}>{(user?.displayName || user?.username || '用').slice(0, 2).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{user?.displayName || user?.username || '用户'}</Text>
            <Text style={s.profileEmail}>{user?.email || '编辑资料'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.dark.textTertiary} />
        </TouchableOpacity>

        {/* 外观 */}
        <Text style={s.secTitle}>偏好设置</Text>
        <View style={s.card}>
          <SettingRow icon="moon" title="外观" subtitle="深色 / 浅色 / 跟随系统" onPress={() => {}} />
          <SettingRow icon="notifications" title="通知" subtitle="系统通知与任务提醒" onPress={() => {}} />
          <SettingRow icon="language" title="语言" subtitle="简体中文" onPress={() => {}} />
        </View>

        {/* 通知开关 */}
        <Text style={s.secTitle}>通知详情</Text>
        <View style={s.card}>
          <SettingRow icon="notifications" title="系统通知" right={<Switch value={notificationSettings.system} onValueChange={v => setNotificationSetting('system', v)} trackColor={{ true: Colors.dark.primary }} />} />
          <SettingRow icon="refresh" title="任务更新" right={<Switch value={notificationSettings.taskUpdates} onValueChange={v => setNotificationSetting('taskUpdates', v)} trackColor={{ true: Colors.dark.primary }} />} />
          <SettingRow icon="checkmark-circle" title="审批请求" right={<Switch value={notificationSettings.approval} onValueChange={v => setNotificationSetting('approval', v)} trackColor={{ true: Colors.dark.primary }} />} />
        </View>

        {/* 账号 */}
        <Text style={s.secTitle}>账号</Text>
        <View style={s.card}>
          <SettingRow icon="wallet" title="用量与账单" onPress={() => {}} />
          <SettingRow icon="chatbubble-ellipses" title="反馈" onPress={() => {}} />
          <SettingRow icon="information-circle" title="关于灵境" subtitle={`版本 ${APP_VERSION}`} onPress={handleCheckUpdate} />
        </View>

        {/* 退出 */}
        <View style={[s.card, { marginTop: 24 }]}>
          <SettingRow icon="log-out" title="退出登录" danger onPress={handleSignOut} />
        </View>
        <Text style={s.footer}>灵境 AI 编程助手 v{APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  header: { paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  hTitle: { color: Colors.dark.text, fontSize: FS.xxl, fontWeight: '700' },
  sc: { padding: 16, paddingBottom: 40 },
  profile: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: BR.lg, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.dark.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.dark.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: Colors.dark.primary, fontSize: FS.md, fontWeight: '700' },
  profileName: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600' },
  profileEmail: { color: Colors.dark.textSecondary, fontSize: FS.sm },
  secTitle: { color: Colors.dark.textSecondary, fontSize: FS.xs, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, marginTop: 8, paddingHorizontal: 4 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, overflow: 'hidden', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  rowDanger: {},
  rowTitle: { color: Colors.dark.text, fontSize: FS.md }, rowSub: { color: Colors.dark.textTertiary, fontSize: FS.xs, marginTop: 2 },
  footer: { color: Colors.dark.textTertiary, fontSize: FS.xs, textAlign: 'center', marginTop: 20 },
});
