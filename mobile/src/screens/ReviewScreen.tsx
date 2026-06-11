// 审批看板 — 需求审批 (App端审批功能)
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore, Requirement } from '../stores/app-store';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#f85149',
  high: '#d29922',
  normal: '#58a6ff',
  low: '#8b949e',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: '紧急', high: '高', normal: '普通', low: '低',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  in_progress: '开发中',
  completed: '已完成',
};

export default function ReviewScreen() {
  const { requirements, setRequirements } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [filter, setFilter] = useState<string>('pending');

  const loadRequirements = useCallback(async () => {
    try {
      const data = await api.getRequirements({ status: filter });
      if (Array.isArray(data)) setRequirements(data);
    } catch (e) {
      console.log('Failed to load requirements:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, setRequirements]);

  useEffect(() => { loadRequirements(); }, [loadRequirements]);

  async function handleReview() {
    if (!selectedReq) return;
    try {
      if (reviewAction === 'approve') {
        await api.approveRequirement(selectedReq.id, reviewComment);
      } else {
        await api.rejectRequirement(selectedReq.id, reviewComment);
      }
      setShowReviewModal(false);
      setReviewComment('');
      loadRequirements();
      Alert.alert('操作成功', reviewAction === 'approve' ? '需求已审批通过' : '需求已拒绝');
    } catch (e: any) {
      Alert.alert('操作失败', e.message);
    }
  }

  function openReview(req: Requirement, action: 'approve' | 'reject') {
    setSelectedReq(req);
    setReviewAction(action);
    setReviewComment('');
    setShowReviewModal(true);
  }

  const pendingCount = requirements.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#58a6ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterBar}>
        {['pending', 'approved', 'rejected', 'all'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => { setFilter(f === 'all' ? '' : f); setLoading(true); }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? '全部' : STATUS_LABELS[f]}
              {f === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={requirements}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[item.priority] || '#8b949e' }]} />
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={[styles.statusBadge, {
                color: item.status === 'approved' ? '#3fb950' : item.status === 'rejected' ? '#f85149' : '#d29922'
              }]}>
                {STATUS_LABELS[item.status] || item.status}
              </Text>
            </View>
            {item.description ? (
              <Text style={styles.description} numberOfLines={3}>{item.description}</Text>
            ) : null}
            <View style={styles.cardMeta}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={styles.metaText}>{PRIORITY_LABELS[item.priority] || item.priority}</Text>
                {item.assignee ? <Text style={styles.metaText}>👤 {item.assignee}</Text> : null}
              </View>
              <Text style={styles.metaText}>{formatTime(item.created_at)}</Text>
            </View>
            {item.status === 'pending' && (
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => openReview(item, 'approve')}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#3fb950" />
                  <Text style={styles.approveText}>通过</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => openReview(item, 'reject')}
                >
                  <Ionicons name="close-circle-outline" size={16} color="#f85149" />
                  <Text style={styles.rejectText}>拒绝</Text>
                </TouchableOpacity>
              </View>
            )}
            {item.reviewer_comment ? (
              <Text style={styles.comment}>💬 {item.reviewer_comment}</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-outline" size={48} color="#30363d" />
            <Text style={styles.emptyText}>
              {filter === 'pending' ? '暂无待审批需求' : '暂无数据'}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequirements(); }} tintColor="#58a6ff" />
        }
        contentContainerStyle={requirements.length === 0 ? styles.emptyContainer : { padding: 8 }}
      />

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {reviewAction === 'approve' ? '✅ 审批通过' : '❌ 拒绝需求'}
            </Text>
            <Text style={styles.modalReqTitle}>{selectedReq?.title}</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="输入审批意见（可选）"
              placeholderTextColor="#484f58"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, {
                  backgroundColor: reviewAction === 'approve' ? '#238636' : '#da3633'
                }]}
                onPress={handleReview}
              >
                <Text style={styles.modalConfirmText}>
                  {reviewAction === 'approve' ? '确认通过' : '确认拒绝'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row', padding: 8, gap: 6,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#21262d',
  },
  filterTabActive: { backgroundColor: '#1f6feb' },
  filterText: { color: '#8b949e', fontSize: 13 },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: '#161b22', borderRadius: 8, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#21262d',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { color: '#c9d1d9', fontSize: 14, fontWeight: '600', flex: 1 },
  statusBadge: { fontSize: 11, fontWeight: '600' },
  description: { color: '#8b949e', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  cardMeta: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaText: { color: '#484f58', fontSize: 11 },
  cardActions: {
    flexDirection: 'row', gap: 8, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: '#21262d',
  },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: '#238636',
  },
  approveText: { color: '#3fb950', fontSize: 14, fontWeight: '600' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: '#da3633',
  },
  rejectText: { color: '#f85149', fontSize: 14, fontWeight: '600' },
  comment: {
    color: '#8b949e', fontSize: 12, fontStyle: 'italic',
    marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#21262d',
  },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { color: '#484f58', fontSize: 14, marginTop: 8 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: '#161b22', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#21262d',
  },
  modalTitle: { color: '#c9d1d9', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  modalReqTitle: { color: '#8b949e', fontSize: 14, marginBottom: 16 },
  commentInput: {
    backgroundColor: '#0d1117', color: '#c9d1d9',
    borderRadius: 8, padding: 12, fontSize: 14,
    borderWidth: 1, borderColor: '#21262d',
    minHeight: 80,
  },
  modalActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16,
  },
  modalCancelBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  modalCancelText: { color: '#8b949e', fontSize: 14 },
  modalConfirmBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 6 },
  modalConfirmText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
