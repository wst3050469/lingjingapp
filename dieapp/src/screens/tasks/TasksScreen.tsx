// 任务列表页 - 对齐 qoder.apk Tasks 设计
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Badge, EmptyState } from '../../components/ui';
import { useAppStore } from '../../stores/app-store';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

const TABS = ['进行中', '全部', '已归档', '已就绪', '待处理', '运行中'];

// 模拟任务数据
const MOCK_TASKS = [
  { id: '1', title: '搭建待办事项应用', lastMessage: '正在编写组件代码…', time: '2分钟前', status: 'running', phase: '运行中' },
  { id: '2', title: '修复登录页面bug', lastMessage: '已定位问题，等待审批', time: '15分钟前', status: 'waiting', phase: '等待审批' },
  { id: '3', title: '重构API服务层', lastMessage: '重构完成，查看 Diff', time: '1小时前', status: 'completed', phase: '已完成' },
  { id: '4', title: '添加单元测试', lastMessage: '测试通过率 94%', time: '3小时前', status: 'idle', phase: '就绪' },
  { id: '5', title: '优化数据库查询', lastMessage: '查询速度提升 40%', time: '昨天', status: 'failed', phase: '失败' },
];

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  running: { color: Colors.dark.primary, bg: Colors.dark.primaryBg },
  waiting: { color: Colors.dark.warning, bg: Colors.dark.warningBg },
  completed: { color: Colors.dark.success, bg: Colors.dark.successBg },
  idle: { color: Colors.dark.textSecondary, bg: Colors.dark.surface2 },
  failed: { color: Colors.dark.danger, bg: Colors.dark.dangerBg },
};

export default function TasksScreen() {
  const { setActiveSession } = useAppStore();
  const [activeTab, setActiveTab] = useState('进行中');
  const [tasks] = useState(MOCK_TASKS);

  function handleArchive(task: any) {
    Alert.alert('归档任务？', `"${task.title}" 将被归档。`, [
      { text: '取消', style: 'cancel' },
      { text: '归档', onPress: () => {} },
    ]);
  }

  function handleDelete(task: any) {
    Alert.alert('删除任务？', `"${task.title}" 将被永久删除。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => {} },
    ]);
  }

  function handleOpen(task: any) {
    setActiveSession(task.id, task.title);
  }

  const renderTask = ({ item }: any) => {
    const sc = STATUS_COLORS[item.status] || STATUS_COLORS.idle;
    return (
      <TouchableOpacity style={s.card} activeOpacity={0.7} onPress={() => handleOpen(item)} onLongPress={() => handleArchive(item)}>
        <View style={s.cardRow}>
          <View style={s.cardInfo}>
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardMsg} numberOfLines={1}>{item.lastMessage}</Text>
          </View>
          <View style={s.cardRight}>
            <Text style={s.cardTime}>{item.time}</Text>
            <Badge label={item.phase} color={sc.color} bgColor={sc.bg} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.c}>
      <View style={s.header}><Text style={s.hTitle}>任务</Text></View>
      {/* Tab 栏 */}
      <FlatList horizontal data={TABS} keyExtractor={t => t} showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabs}
        renderItem={({ item }) => (
          <TouchableOpacity style={[s.tab, activeTab === item && s.tabActive]} onPress={() => setActiveTab(item)}>
            <Text style={[s.tabText, activeTab === item && s.tabTextActive]}>{item}</Text>
          </TouchableOpacity>
        )} />
      {/* 任务列表 */}
      {tasks.length > 0 ? (
        <FlatList data={tasks} renderItem={renderTask} keyExtractor={t => t.id}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false} />
      ) : (
        <EmptyState icon="📋" title="暂无任务" description="点击 + 启动任务，或在桌面端开启 Remote Control 同步任务" />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  header: { paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  hTitle: { color: Colors.dark.text, fontSize: FS.xxl, fontWeight: '700' },
  tabs: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BR.full, backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border },
  tabActive: { backgroundColor: Colors.dark.primaryBg, borderColor: Colors.dark.primary },
  tabText: { color: Colors.dark.textSecondary, fontSize: FS.sm, fontWeight: '500' },
  tabTextActive: { color: Colors.dark.primary },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: Colors.dark.surface, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, padding: 16 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardInfo: { flex: 1, marginRight: 12 },
  cardTitle: { color: Colors.dark.text, fontSize: FS.md, fontWeight: '600', marginBottom: 4 },
  cardMsg: { color: Colors.dark.textTertiary, fontSize: FS.sm },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardTime: { color: Colors.dark.textTertiary, fontSize: FS.xs },
});
