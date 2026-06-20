// 文件浏览器页 — 桌面(WebSocket) + 云端(HTTP) 双通道
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export default function FileTreeScreen() {
  const navigation = useNavigation<any>();
  const [currentPath, setCurrentPath] = useState('/root/cloud-server');
  const [entries, setEntries] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cloudMode, setCloudMode] = useState(false);

  const loadDir = useCallback(async (path: string) => {
    try {
      // Try desktop WebSocket first
      const result = await api.wsCommand('file', 'list', { path });
      if (result?.entries && result.entries.length > 0) {
        setEntries(result.entries);
        setCloudMode(false);
        return;
      }
      throw new Error('empty');
    } catch {
      // Desktop offline → use cloud server file list
      try {
        const result = await api.listCloudFiles(path);
        if (result?.entries) {
          setEntries(result.entries);
          setCloudMode(true);
          return;
        }
      } catch { /* cloud also failed */ }
      setEntries([]);
      setCloudMode(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { loadDir(currentPath); }, [currentPath, loadDir]);

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
    setLoading(true);
  };

  const getIcon = (name: string, type: string): keyof typeof Ionicons.glyphMap => {
    if (type === 'dir') return 'folder-outline';
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': case 'js': case 'jsx': case 'py': case 'go': return 'code-slash-outline';
      case 'json': case 'yml': case 'yaml': case 'toml': return 'code-outline';
      case 'md': return 'document-text-outline';
      case 'sh': return 'terminal-outline';
      default: return 'document-outline';
    }
  };

  const fmtSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  if (loading && entries.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#58a6ff" />
        <Text style={s.loadingText}>加载文件中...</Text>
      </View>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <View style={s.container}>
      {cloudMode && (
        <View style={s.banner}>
          <Ionicons name="cloud-outline" size={14} color="#58a6ff" />
          <Text style={s.bannerText}>云端文件 (桌面离线)</Text>
        </View>
      )}

      <View style={s.breadcrumb}>
        <TouchableOpacity onPress={() => { setCurrentPath('/root/cloud-server'); setLoading(true); }}>
          <Ionicons name="server-outline" size={16} color="#58a6ff" />
        </TouchableOpacity>
        <Text style={s.pathText} numberOfLines={1}>{currentPath}</Text>
        <TouchableOpacity onPress={goUp}>
          <Ionicons name="arrow-up-outline" size={16} color="#8b949e" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => item.path}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.item}
            onPress={() => {
              if (item.type === 'dir') {
                setCurrentPath(item.path);
                setLoading(true);
              } else if (cloudMode) {
                // Read from cloud
                navigation.navigate('CodeEditor', { filePath: item.path, fileName: item.name });
              } else {
                navigation.navigate('CodeEditor', { filePath: item.path, fileName: item.name });
              }
            }}
          >
            <Ionicons name={getIcon(item.name, item.type)} size={18} color={item.type === 'dir' ? '#58a6ff' : '#8b949e'} />
            <Text style={[s.itemName, item.type === 'dir' && s.dirName]} numberOfLines={1}>{item.name}</Text>
            {item.type === 'file' && <Text style={s.size}>{fmtSize(item.size)}</Text>}
            {item.type === 'dir' && <Ionicons name="chevron-forward" size={14} color="#30363d" />}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="folder-open-outline" size={48} color="#30363d" />
            <Text style={s.emptyText}>{cloudMode ? '云端目录为空' : '无法连接桌面'}</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDir(currentPath); }} tintColor="#58a6ff" />}
        contentContainerStyle={sorted.length === 0 ? s.emptyContainer : undefined}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b949e', marginTop: 8, fontSize: 13 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, backgroundColor: '#1c2a3d', justifyContent: 'center' },
  bannerText: { color: '#58a6ff', fontSize: 11 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d', gap: 6 },
  pathText: { color: '#8b949e', fontSize: 12, flex: 1, fontFamily: 'monospace' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#21262d', gap: 8 },
  itemName: { color: '#c9d1d9', fontSize: 13, flex: 1 },
  dirName: { color: '#58a6ff', fontWeight: '500' },
  size: { color: '#484f58', fontSize: 11, marginRight: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { color: '#484f58', fontSize: 14, marginTop: 8 },
});
