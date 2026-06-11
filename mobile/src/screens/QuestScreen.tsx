// 任务看板页
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../services/api';
import { useAppStore, QuestTask } from '../stores/app-store';

const STATUS_COLORS: Record<string, string> = {
  idle: '#484f58',
  running: '#d29922',
  completed: '#3fb950',
  failed: '#f85149',
  cancelled: '#8b949e',
};

const STATUS_LABELS: Record<string, string> = {
  idle: '待开始',
  running: '进行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

const SCENARIO_LABELS: Record<string, string> = {
  spec: '需求分析',
  design: '架构设计',
  implement: '代码实现',
  test: '测试',
  deploy: '部署',
};

export default function QuestScreen() {
  const { tasks, setTasks } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const data = await api.getTasks();
      if (Array.isArray(data)) {
        setTasks(data);
      }
    } catch (e) {
      console.log('Failed to load tasks:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setTasks]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  function groupByStatus(list: QuestTask[]) {
    const groups: Record<string, QuestTask[]> = { idle: [], running: [], completed: [], failed: [], cancelled: [] };
    list.forEach(t => {
      const s = t.status || 'idle';
      if (groups[s]) groups[s].push(t);
      else groups.idle.push(t);
    });
    return groups;
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#58a6ff" /></View>;
  }

  const grouped = groupByStatus(tasks);
  const columns = ['running', 'idle', 'completed', 'failed'];

  return (
    <FlatList
      data={columns}
      keyExtractor={item => item}
      horizontal
      contentContainerStyle={styles.board}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTasks(); }} />}
      renderItem={({ item: status }) => (
        <View style={styles.column}>
          <View style={styles.columnHeader}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
            <Text style={styles.columnTitle}>{STATUS_LABELS[status]}</Text>
            <Text style={styles.count}>{grouped[status].length}</Text>
          </View>
          <FlatList
            data={grouped[status]}
            keyExtractor={t => t.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.scenario}>{SCENARIO_LABELS[item.scenario] || item.scenario}</Text>
                  <Text style={styles.time}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyCol}>-</Text>}
          />
        </View>
      )}
      showsHorizontalScrollIndicator
    />
  );
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  board: { padding: 8 },
  column: { width: 200, marginHorizontal: 4, backgroundColor: '#161b22', borderRadius: 8, padding: 8 },
  columnHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#21262d' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  columnTitle: { color: '#c9d1d9', fontSize: 14, fontWeight: '600', flex: 1 },
  count: { color: '#8b949e', fontSize: 12 },
  card: { backgroundColor: '#0d1117', borderRadius: 6, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#21262d' },
  cardTitle: { color: '#c9d1d9', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  scenario: { color: '#58a6ff', fontSize: 11 },
  time: { color: '#484f58', fontSize: 11 },
  emptyCol: { color: '#484f58', textAlign: 'center', padding: 20 },
});
