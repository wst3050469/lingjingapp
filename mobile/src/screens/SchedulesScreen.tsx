// 定时任务管理页 (移植自 mobile/SchedulesScreen + lingjing-mobile 暗色风格)
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore, Schedule } from '../stores/app-store';

const ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  http: 'globe-outline',
  shell: 'terminal-outline',
  webhook: 'link-outline',
};

const ACTION_LABELS: Record<string, string> = {
  http: 'HTTP 请求',
  shell: 'Shell 命令',
  webhook: 'Webhook',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#3fb950',
  paused: '#d29922',
  error: '#f85149',
  inactive: '#484f58',
};

const STATUS_LABELS: Record<string, string> = {
  active: '运行中',
  paused: '已暂停',
  error: '异常',
  inactive: '未激活',
};

export default function SchedulesScreen() {
  const { schedules, setSchedules } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listSchedules();
      const list = Array.isArray(data) ? data : (data.schedules || []);
      setSchedules(list);
    } catch (e) {
      console.log('Failed to load schedules:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setSchedules]);

  useEffect(() => { load(); }, [load]);

  const handleTrigger = (item: Schedule) => {
    Alert.alert('立即执行', `确定要执行"${item.name}"？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '执行',
        onPress: async () => {
          try {
            await api.triggerSchedule(item.id);
            Alert.alert('成功', '定时任务已触发执行');
          } catch (e: any) {
            Alert.alert('失败', e?.message || '请重试');
          }
        },
      },
    ]);
  };

  const handleDelete = (item: Schedule) => {
    Alert.alert('删除任务', `确定要删除"${item.name}"？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSchedule(item.id);
            setSchedules(schedules.filter(s => s.id !== item.id));
          } catch (e: any) {
            Alert.alert('失败', e?.message || '请重试');
          }
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#58a6ff" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={schedules}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons
                  name={ACTION_ICONS[item.action_type] || 'time-outline'}
                  size={18}
                  color="#58a6ff"
                />
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLORS[item.status] || '#484f58') + '22' }]}>
                <View style={[styles.dot, { backgroundColor: STATUS_COLORS[item.status] || '#484f58' }]} />
                <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] || '#484f58' }]}>
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color="#484f58" />
              <Text style={styles.detailText}>{item.cron_expr}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="pulse-outline" size={14} color="#484f58" />
              <Text style={styles.detailText}>{ACTION_LABELS[item.action_type] || item.action_type}</Text>
            </View>
            {item.last_run && (
              <View style={styles.detailRow}>
                <Ionicons name="return-down-back-outline" size={14} color="#484f58" />
                <Text style={styles.detailText}>上次: {new Date(item.last_run).toLocaleString('zh-CN')}</Text>
              </View>
            )}
            {item.next_run && (
              <View style={styles.detailRow}>
                <Ionicons name="return-down-forward-outline" size={14} color="#484f58" />
                <Text style={styles.detailText}>下次: {new Date(item.next_run).toLocaleString('zh-CN')}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleTrigger(item)}>
                <Ionicons name="play" size={14} color="#3fb950" />
                <Text style={[styles.actionText, { color: '#3fb950' }]}>执行</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
                <Ionicons name="trash-outline" size={14} color="#f85149" />
                <Text style={[styles.actionText, { color: '#f85149' }]}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color="#30363d" />
            <Text style={styles.emptyText}>暂无定时任务</Text>
            <Text style={styles.emptyHint}>在桌面端灵境创建定时任务后自动同步</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#58a6ff" />
        }
        contentContainerStyle={schedules.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center' },
  emptyText: { color: '#484f58', fontSize: 16, marginTop: 12 },
  emptyHint: { color: '#30363d', fontSize: 13, marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: '#161b22', borderRadius: 8, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#21262d',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle: { color: '#c9d1d9', fontSize: 15, fontWeight: '600', flex: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, gap: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  detailText: { color: '#8b949e', fontSize: 13 },
  actions: { flexDirection: 'row', marginTop: 10, gap: 8, borderTopWidth: 1, borderTopColor: '#21262d', paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#21262d' },
  actionText: { fontSize: 13, fontWeight: '500' },
  deleteBtn: { backgroundColor: 'rgba(248,81,73,0.1)' },
});
