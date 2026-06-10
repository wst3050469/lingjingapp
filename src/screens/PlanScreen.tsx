// 计划列表页
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore, Plan, PlanDetail } from '../stores/app-store';

const STATUS_COLORS: Record<string, string> = {
  draft: '#484f58', reviewing: '#d29922', approved: '#58a6ff',
  executing: '#3fb950', paused: '#d29922', completed: '#3fb950', cancelled: '#f85149',
};
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', reviewing: '审核中', approved: '已批准',
  executing: '执行中', paused: '已暂停', completed: '已完成', cancelled: '已取消',
};

export default function PlanScreen() {
  const { plans, setPlans } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<Map<string, PlanDetail>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadPlans(); }, []);

  async function loadPlans() {
    try {
      const data = await api.getPlans();
      setPlans(data.plans || []);
    } catch (e) { console.log('Failed to load plans:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!planDetails.has(id)) {
      try {
        const detail = await api.getPlan(id);
        setPlanDetails(prev => new Map(prev).set(id, detail));
      } catch (e) { console.log('Failed to load plan detail:', e); }
    }
  }

  function renderItem({ item }: { item: Plan }) {
    const expanded = expandedId === item.id;
    const detail = planDetails.get(item.id);
    const color = STATUS_COLORS[item.status] || '#484f58';

    return (
      <TouchableOpacity style={styles.card} onPress={() => toggleExpand(item.id)}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBar, { backgroundColor: color }]} />
          <View style={styles.cardContent}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.meta}>
              <View style={styles.badge}>
                <Text style={[styles.badgeText, { color }]}>{STATUS_LABELS[item.status]}</Text>
              </View>
              <Text style={styles.time}>{formatTime(item.created_at)}</Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#484f58" />
        </View>

        {expanded && detail && (
          <View style={styles.expanded}>
            <Text style={styles.sectionTitle}>目标</Text>
            {(detail.goals || []).map((g: string, i: number) => (
              <Text key={i} style={styles.goal}>• {g}</Text>
            ))}
            <Text style={styles.sectionTitle}>步骤 ({detail.steps?.length || 0})</Text>
            {(detail.steps || []).map((s, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepDot, { backgroundColor: STATUS_COLORS[s.status] || '#484f58' }]} />
                <Text style={styles.stepText}>{s.title} ({s.status})</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#58a6ff" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={plans}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>暂无计划</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlans(); }} />}
        contentContainerStyle={plans.length === 0 ? styles.emptyContainer : styles.listContent}
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
  listContent: { padding: 12 },
  empty: { color: '#484f58', textAlign: 'center', fontSize: 14 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  card: { backgroundColor: '#161b22', borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#21262d', overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  statusBar: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: 12 },
  title: { color: '#c9d1d9', fontSize: 15, fontWeight: '600' },
  desc: { color: '#8b949e', fontSize: 13, marginTop: 4, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  badge: { backgroundColor: 'rgba(88,166,255,0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11 },
  time: { color: '#484f58', fontSize: 11, marginLeft: 8 },
  expanded: { padding: 12, borderTopWidth: 1, borderTopColor: '#21262d', backgroundColor: '#0d1117' },
  sectionTitle: { color: '#58a6ff', fontSize: 12, fontWeight: '600', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  goal: { color: '#8b949e', fontSize: 13, marginLeft: 8, lineHeight: 20 },
  step: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, marginTop: 4 },
  stepDot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  stepText: { color: '#c9d1d9', fontSize: 13 },
});
