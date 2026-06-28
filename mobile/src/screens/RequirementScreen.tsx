// 需求下发页 — 创建/管理需求
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore, Requirement } from '../stores/app-store';

const PRIORITY_OPTIONS = [
  { label: '紧急', value: 'urgent', color: '#f85149' },
  { label: '高', value: 'high', color: '#d29922' },
  { label: '普通', value: 'normal', color: '#58a6ff' },
  { label: '低', value: 'low', color: '#8b949e' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: '待审批', approved: '已通过', rejected: '已拒绝',
  in_progress: '开发中', completed: '已完成',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#d29922', approved: '#3fb950', rejected: '#f85149',
  in_progress: '#58a6ff', completed: '#8b949e',
};

export default function RequirementScreen() {
  const { requirements, setRequirements } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [priority, setPriority] = useState('normal');
  const [creating, setCreating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRequirements = useCallback(async () => {
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      const data = await api.getRequirements(params);
      if (Array.isArray(data)) setRequirements(data);
    } catch (e) {
      console.log('Failed to load requirements:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus, setRequirements]);

  useEffect(() => { loadRequirements(); }, [loadRequirements]);

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert('提示', '请输入需求标题');
      return;
    }
    try {
      setCreating(true);
      await api.createRequirement({
        title: title.trim(),
        description: description.trim(),
        assignee: assignee.trim(),
        priority,
      });
      setShowCreate(false);
      setTitle(''); setDescription(''); setAssignee(''); setPriority('normal');
      Alert.alert('创建成功', '需求已提交审批');
      loadRequirements();
    } catch (e: any) {
      Alert.alert('创建失败', e.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('删除需求', '确定要删除这个需求吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRequirement(id);
            loadRequirements();
          } catch (e: any) {
            Alert.alert('删除失败', e.message);
          }
        },
      },
    ]);
  }

  const statusFilters = [
    { label: '全部', value: '' },
    { label: '待审批', value: 'pending' },
    { label: '已通过', value: 'approved' },
    { label: '开发中', value: 'in_progress' },
    { label: '已完成', value: 'completed' },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#58a6ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter bar */}
      <View style={styles.filterBar}>
        <ScrollableFilters
          filters={statusFilters}
          activeFilter={filterStatus}
          onSelect={setFilterStatus}
        />
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.createBtnText}>新建</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={requirements}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] || '#484f58' }]} />
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={[styles.priorityTag, { color: PRIORITY_OPTIONS.find(p => p.value === item.priority)?.color || '#8b949e' }]}>
                  {item.priority}
                </Text>
                <Text style={[styles.statusTag, { color: STATUS_COLORS[item.status] || '#484f58' }]}>
                  {STATUS_LABELS[item.status] || item.status}
                </Text>
              </View>
            </TouchableOpacity>

            {expandedId === item.id && (
              <View style={styles.cardDetail}>
                {item.description ? (
                  <Text style={styles.descText}>{item.description}</Text>
                ) : (
                  <Text style={styles.noDesc}>暂无描述</Text>
                )}
                <View style={styles.detailMeta}>
                  {item.assignee ? <Text style={styles.metaText}>👤 {item.assignee}</Text> : null}
                  <Text style={styles.metaText}>{item.created_by}</Text>
                  <Text style={styles.metaText}>{formatTime(item.created_at)}</Text>
                </View>
                {item.reviewer_comment && (
                  <Text style={styles.comment}>💬 {item.reviewer_comment}</Text>
                )}
                <View style={styles.cardActions}>
                  {item.status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={styles.actionBtnSmall}
                        onPress={async () => {
                          await api.approveRequirement(item.id);
                          loadRequirements();
                        }}
                      >
                        <Ionicons name="checkmark" size={16} color="#3fb950" />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.actionBtnSmall}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#f85149" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color="#30363d" />
            <Text style={styles.emptyText}>暂无需求</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={styles.emptyBtnText}>+ 创建新需求</Text>
            </TouchableOpacity>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequirements(); }} tintColor="#58a6ff" />
        }
        contentContainerStyle={requirements.length === 0 ? styles.emptyContainer : { padding: 8 }}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 创建新需求</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color="#8b949e" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>需求标题 *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="输入需求标题"
              placeholderTextColor="#484f58"
            />

            <Text style={styles.inputLabel}>详细描述</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="描述需求详情..."
              placeholderTextColor="#484f58"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>指派给</Text>
            <TextInput
              style={styles.input}
              value={assignee}
              onChangeText={setAssignee}
              placeholder="开发者名称"
              placeholderTextColor="#484f58"
            />

            <Text style={styles.inputLabel}>优先级</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.priorityOption,
                    priority === p.value && { backgroundColor: p.color + '22', borderColor: p.color },
                  ]}
                  onPress={() => setPriority(p.value)}
                >
                  <Text style={[styles.priorityOptionText, { color: priority === p.value ? p.color : '#8b949e' }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, !title.trim() && styles.submitBtnDisabled]}
              onPress={handleCreate}
              disabled={creating || !title.trim()}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>提交需求</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ScrollableFilters({ filters, activeFilter, onSelect }: {
  filters: { label: string; value: string }[];
  activeFilter: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexShrink: 1, flexWrap: 'wrap' }}>
      {filters.map(f => (
        <TouchableOpacity
          key={f.value}
          onPress={() => onSelect(f.value)}
          style={[
            { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#21262d' },
            activeFilter === f.value && { backgroundColor: '#1f6feb' },
          ]}
        >
          <Text style={{ color: activeFilter === f.value ? '#fff' : '#8b949e', fontSize: 12 }}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
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
  filterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 8, backgroundColor: '#161b22',
    borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#238636', borderRadius: 16, marginLeft: 8,
  },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#161b22', borderRadius: 8, marginBottom: 8,
    borderWidth: 1, borderColor: '#21262d', overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12,
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { color: '#c9d1d9', fontSize: 14, fontWeight: '500', flex: 1 },
  priorityTag: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statusTag: { fontSize: 11 },
  cardDetail: {
    padding: 12, paddingTop: 0,
    borderTopWidth: 1, borderTopColor: '#21262d',
  },
  descText: { color: '#8b949e', fontSize: 13, lineHeight: 20, marginTop: 8 },
  noDesc: { color: '#484f58', fontSize: 13, fontStyle: 'italic', marginTop: 8 },
  detailMeta: {
    flexDirection: 'row', justifyContent: 'flex-start', gap: 12,
    marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#21262d',
  },
  metaText: { color: '#484f58', fontSize: 11 },
  comment: {
    color: '#8b949e', fontSize: 12, fontStyle: 'italic',
    marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#21262d',
  },
  cardActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8,
  },
  actionBtnSmall: { padding: 6 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { color: '#484f58', fontSize: 14, marginTop: 8 },
  emptyBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#21262d', borderRadius: 8 },
  emptyBtnText: { color: '#58a6ff', fontSize: 14 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161b22', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: '#c9d1d9', fontSize: 18, fontWeight: '600' },
  inputLabel: { color: '#8b949e', fontSize: 12, marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#0d1117', color: '#c9d1d9',
    borderRadius: 8, padding: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#21262d',
  },
  textArea: { minHeight: 80 },
  priorityRow: { flexDirection: 'row', gap: 6 },
  priorityOption: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    borderWidth: 1, borderColor: '#21262d',
  },
  priorityOptionText: { fontSize: 13, fontWeight: '500' },
  submitBtn: {
    marginTop: 20, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#238636', alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#21262d' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
