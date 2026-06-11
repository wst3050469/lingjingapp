// 对话列表页
import React, { useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { api } from '../services/api';
import { useAppStore, Session } from '../stores/app-store';
import { Ionicons } from '@expo/vector-icons';

export default function ChatListScreen() {
  const { sessions, setSessions, connected } = useAppStore();
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

  // Auto-refresh when tab gains focus (e.g. returning from ChatDetail)
  useFocusEffect(useCallback(() => {
    if (!loading) {
      loadSessions();
    }
  }, [loadSessions, loading]));

  async function createNewSession() {
    if (creating) return;
    // Check if API is configured (baseUrl must be present)
    const cfg = api.getConfig();
    if (!cfg.baseUrl) {
      console.log('[ChatList] API not configured, cannot create session');
      return;
    }
    setCreating(true);
    try {
      const newId = 'chat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await api.upsertSession({
        id: newId,
        title: '新对话',
        messages: [],
      });
      navigation.navigate('ChatDetail', { sessionId: newId, title: '新对话' });
    } catch (e) {
      console.log('Failed to create session:', e);
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
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={48} color="#30363d" />
            <Text style={styles.empty}>暂无对话</Text>
            <Text style={styles.emptyHint}>点击右下角 + 按钮开始新对话</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSessions(); }} />}
        contentContainerStyle={sessions.length === 0 ? styles.emptyContainer : undefined}
      />
      <TouchableOpacity
        style={[styles.fab, creating && styles.fabDisabled]}
        onPress={createNewSession}
        disabled={creating}
        activeOpacity={0.7}
      >
        {creating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="add" size={28} color="#fff" />
        )}
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
  empty: { color: '#484f58', fontSize: 14, textAlign: 'center', marginTop: 12 },
  emptyHint: { color: '#30363d', fontSize: 13, textAlign: 'center', marginTop: 6 },
  emptyWrap: { alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#1f6feb',
    justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#1f6feb', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  fabDisabled: { opacity: 0.6 },
});
