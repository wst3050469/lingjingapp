// 对话列表页
import React, { useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useAppStore, Session } from '../stores/app-store';

export default function ChatListScreen() {
  const { sessions, setSessions } = useAppStore();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const navigation = useNavigation<any>();

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.getSessions();
      setSessions(data.sessions || []);
    } catch (e) {
      console.log('Failed to load sessions:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setSessions]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // BUGFIX: 新建对话 — 调用 API 创建后自动跳转
  async function handleNewChat() {
    if (creating) return;
    setCreating(true);
    try {
      const result = await api.upsertSession({
        title: '新对话',
        messages: [],
        type: 'chat',
      });
      const newId = result?.session?.id || result?.id;
      if (newId) {
        await loadSessions();
        navigation.navigate('ChatDetail', { sessionId: newId, title: '新对话' });
      }
    } catch (e: any) {
      console.log('Create session failed:', e?.message);
      // 即使 API 失败也尝试跳转（本地兜底）
    } finally {
      setCreating(false);
    }
  }

  function renderItem({ item }: { item: Session }) {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => navigation.navigate('ChatDetail', { sessionId: item.id, title: item.title })}
      >
        <View style={styles.itemHeader}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.time}>{formatTime(item.updated_at)}</Text>
        </View>
        {item.last_message && (
          <Text style={styles.preview} numberOfLines={2}>{item.last_message}</Text>
        )}
      </TouchableOpacity>
    );
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
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptySection}>
            <Ionicons name="chatbubbles-outline" size={48} color="#30363d" />
            <Text style={styles.empty}>暂无对话</Text>
            <Text style={styles.emptyHint}>点击下方按钮创建新对话</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSessions(); }} />}
        contentContainerStyle={sessions.length === 0 ? styles.emptyContainer : undefined}
      />
      {/* BUGFIX: 新建对话按钮 */}
      <TouchableOpacity
        style={[styles.newChatBtn, creating && { opacity: 0.5 }]}
        onPress={handleNewChat}
        disabled={creating}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.newChatText}>{creating ? '创建中...' : '新建对话'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  item: {
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  title: { color: '#c9d1d9', fontSize: 16, fontWeight: '600', flex: 1 },
  time: { color: '#8b949e', fontSize: 12, marginLeft: 8 },
  preview: { color: '#8b949e', fontSize: 14, lineHeight: 20 },
  // BUGFIX: 空状态与新建对话按钮样式
  emptySection: { alignItems: 'center', paddingTop: 60 },
  empty: { color: '#484f58', fontSize: 15, marginTop: 12 },
  emptyHint: { color: '#30363d', fontSize: 13, marginTop: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1f6feb', margin: 16, paddingVertical: 14,
    borderRadius: 12, gap: 8,
  },
  newChatText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
