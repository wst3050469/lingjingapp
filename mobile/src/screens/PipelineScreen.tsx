// CI/CD 进度页 — 查看构建/部署状态
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore, CiJob } from '../stores/app-store';

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  completed: 'checkmark-circle',
  running: 'sync-circle',
  failed: 'close-circle',
  idle: 'time-outline',
  active: 'play-circle-outline',
  paused: 'pause-circle-outline',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#3fb950',
  running: '#58a6ff',
  failed: '#f85149',
  idle: '#484f58',
  active: '#d29922',
  paused: '#8b949e',
};

const STATUS_LABELS: Record<string, string> = {
  completed: '成功',
  running: '运行中',
  failed: '失败',
  idle: '空闲',
  active: '等待中',
  paused: '暂停',
};

export default function PipelineScreen() {
  const { ciJobs, ciHistory, setCiStatus } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCiStatus = useCallback(async () => {
    try {
      const result = await api.getCiStatus();
      setCiStatus(result.jobs || [], result.history || []);
    } catch (e) {
      console.log('Failed to load CI status:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setCiStatus]);

  useEffect(() => { loadCiStatus(); }, [loadCiStatus]);

  function getStatusIcon(job: CiJob) {
    const s = job.status || 'idle';
    return STATUS_ICONS[s] || 'ellipse-outline';
  }

  function getStatusColor(job: CiJob) {
    const s = job.status || 'idle';
    return STATUS_COLORS[s] || '#484f58';
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#58a6ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary bar */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryCount}>{ciJobs.length}</Text>
          <Text style={styles.summaryLabel}>总任务</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, { color: '#3fb950' }]}>
            {ciJobs.filter(j => j.status === 'completed').length}
          </Text>
          <Text style={styles.summaryLabel}>成功</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, { color: '#f85149' }]}>
            {ciJobs.filter(j => j.status === 'failed').length}
          </Text>
          <Text style={styles.summaryLabel}>失败</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, { color: '#58a6ff' }]}>
            {ciJobs.filter(j => j.status === 'running').length}
          </Text>
          <Text style={styles.summaryLabel}>运行中</Text>
        </View>
      </View>

      {/* Job list */}
      <FlatList
        data={ciJobs}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <Text style={styles.sectionHeader}>构建任务</Text>
        }
        renderItem={({ item: job }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Ionicons
                name={getStatusIcon(job)}
                size={22}
                color={getStatusColor(job)}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.jobName} numberOfLines={1}>{job.name}</Text>
                <Text style={styles.jobAction}>{job.action}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.statusText, { color: getStatusColor(job) }]}>
                  {STATUS_LABELS[job.status] || job.status}
                </Text>
                {job.cron && <Text style={styles.cronText}>{job.cron}</Text>}
              </View>
            </View>
            <View style={styles.jobMeta}>
              {job.lastRun && <Text style={styles.metaText}>上次: {formatTime(job.lastRun)}</Text>}
              {job.nextRun && <Text style={styles.metaText}>下次: {formatTime(job.nextRun)}</Text>}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="rocket-outline" size={48} color="#30363d" />
            <Text style={styles.emptyText}>暂无CI/CD任务</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCiStatus(); }} tintColor="#58a6ff" />
        }
        contentContainerStyle={ciJobs.length === 0 ? styles.emptyContainer : { padding: 8 }}
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
  summary: {
    flexDirection: 'row', padding: 12, gap: 8,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  summaryItem: {
    flex: 1, alignItems: 'center',
    paddingVertical: 6, backgroundColor: '#0d1117', borderRadius: 8,
  },
  summaryCount: { color: '#c9d1d9', fontSize: 20, fontWeight: '700' },
  summaryLabel: { color: '#484f58', fontSize: 11, marginTop: 2 },
  sectionHeader: {
    color: '#8b949e', fontSize: 12, fontWeight: '600',
    paddingHorizontal: 4, paddingVertical: 8,
  },
  card: {
    backgroundColor: '#161b22', borderRadius: 8, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#21262d',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  jobName: { color: '#c9d1d9', fontSize: 14, fontWeight: '600' },
  jobAction: { color: '#58a6ff', fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  statusText: { fontSize: 13, fontWeight: '600' },
  cronText: { color: '#484f58', fontSize: 10, fontFamily: 'monospace', marginTop: 2 },
  jobMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#21262d',
  },
  metaText: { color: '#484f58', fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { color: '#484f58', fontSize: 14, marginTop: 8 },
});
