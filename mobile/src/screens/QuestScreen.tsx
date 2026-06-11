// 任务看板页 — 云API后备（桌面离线时从requirements表加载）
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { api } from '../services/api';
import { useAppStore, QuestTask } from '../stores/app-store';

const STATUS_COLORS: Record<string, string> = {
  idle: '#484f58', running: '#d29922', completed: '#3fb950',
  failed: '#f85149', cancelled: '#8b949e', pending: '#d29922',
  approved: '#3fb950', rejected: '#f85149', in_progress: '#58a6ff',
};

const STATUS_LABELS: Record<string, string> = {
  idle: '待开始', running: '进行中', completed: '已完成',
  failed: '失败', cancelled: '已取消', pending: '待审批',
  approved: '已通过', rejected: '已拒绝', in_progress: '开发中',
};

const SCENARIO_LABELS: Record<string, string> = {
  spec: '需求分析', design: '架构设计', implement: '代码实现',
  test: '测试', deploy: '部署',
};

export default function QuestScreen() {
  const { tasks, setTasks } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCloudMode, setIsCloudMode] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      // First try desktop tasks
      const data = await api.getTasks();
      if (Array.isArray(data) && data.length > 0) {
        setTasks(data);
        setIsCloudMode(false);
      } else {
        // Fallback to cloud requirements as tasks
        const reqs = await api.getRequirements();
        if (Array.isArray(reqs) && reqs.length > 0) {
          const mapped: QuestTask[] = reqs.map((r: any) => ({
            id: r.id,
            title: r.title,
            status: r.status || 'idle',
            scenario: 'spec',
            created_at: r.created_at,
          }));
          setTasks(mapped);
        } else {
          setTasks([]);
        }
        setIsCloudMode(true);
      }
    } catch (e) {
      console.log('Failed to load tasks, trying requirements:', e);
      try {
        const reqs = await api.getRequirements();
        if (Array.isArray(reqs)) {
          const mapped: QuestTask[] = reqs.map((r: any) => ({
            id: r.id,
            title: r.title,
            status: r.status || 'idle',
            scenario: 'spec',
            created_at: r.created_at,
          }));
          setTasks(mapped);
          setIsCloudMode(true);
        }
      } catch (e2) {
        setTasks([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setTasks]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  function groupByStatus(list: QuestTask[]) {
    const groups: Record<string, QuestTask[]> = { idle: [], running: [], completed: [], failed: [], cancelled: [], pending: [], approved: [], in_progress: [] };
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
  const columns = tasks.length > 0 ? Object.keys(grouped).filter(s => grouped[s].length > 0) : ['idle'];

  return (
    <View style={styles.container}>
      {isCloudMode && tasks.length > 0 && (
        <View style={styles.cloudBanner}>
          <Text style={styles.cloudBannerText}>📋 显示云端需求 — 电脑端离线中</Text>
        </View>
      )}
      <FlatList
        data={columns}
        keyExtractor={item => item}
        horizontal
        contentContainerStyle={styles.board}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTasks(); }} />}
        renderItem={({ item: status }) => (
          <View style={styles.column}>
            <View style={styles.columnHeader}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] || '#484f58' }]} />
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
        ListEmptyComponent={
          <View style={styles.emptyAll}>
            <Text style={styles.emptyAllText}>{isCloudMode ? '暂无需求，去「开发」页创建' : '暂无任务'}</Text>
          </View>
        }
      />
    </View>
  );
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  cloudBanner: {
    backgroundColor: '#1c2a3d', padding: 8, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  cloudBannerText: { color: '#58a6ff', fontSize: 12 },
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
  emptyAll: { width: 300, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyAllText: { color: '#484f58', fontSize: 14 },
});
