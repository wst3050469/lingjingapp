// 对话列表页
import React, { useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
import { useAppStore, Session } from '../stores/app-store';

export default function ChatListScreen() {
  const { sessions, setSessions } = useAppStore();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
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
        ListEmptyComponent={<Text style={styles.empty}>暂无对话</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSessions(); }} />}
        contentContainerStyle={sessions.length === 0 ? styles.emptyContainer : undefined}
      />
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
  empty: { color: '#484f58', fontSize: 14, textAlign: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center' },
});
