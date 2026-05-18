// 文件浏览器页 — 浏览桌面端项目文件树
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

export default function FileTreeScreen() {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const loadDir = useCallback(async (path: string) => {
    try {
      // Use WebSocket to browse files
      const result = await api.wsCommand('file', 'list', { path });
      if (result?.entries) {
        setEntries(result.entries);
      } else {
        setEntries([]);
      }
    } catch (e) {
      console.log('Failed to load directory:', e);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // On mount, load root
  React.useEffect(() => { loadDir(currentPath); }, [currentPath, loadDir]);

  const toggleDir = async (node: FileNode) => {
    if (node.type !== 'dir') return;
    const key = node.path;
    if (expandedDirs.has(key)) {
      setExpandedDirs(prev => { const s = new Set(prev); s.delete(key); return s; });
    } else {
      setExpandedDirs(prev => new Set(prev).add(key));
    }
  };

  const navigateToDir = (path: string) => {
    setCurrentPath(path);
    setLoading(true);
  };

  const goUp = () => {
    const parent = currentPath === '/' ? '/' : currentPath.split('/').slice(0, -1).join('/') || '/';
    setCurrentPath(parent);
    setLoading(true);
  };

  const getFileIcon = (name: string, type: string): keyof typeof Ionicons.glyphMap => {
    if (type === 'dir') return expandedDirs.has(name) ? 'folder-open-outline' : 'folder-outline';
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': case 'js': case 'jsx': return 'code-slash-outline';
      case 'json': return 'code-outline';
      case 'md': return 'document-text-outline';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return 'image-outline';
      case 'css': case 'scss': return 'color-palette-outline';
      default: return 'document-outline';
    }
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  if (loading && entries.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#58a6ff" />
        <Text style={styles.loadingText}>正在加载文件...</Text>
      </View>
    );
  }

  const allEntries = entries;
  const sorted = [...allEntries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Combine current entries with expanded subdirectories' children
  const displayEntries = sorted;

  return (
    <View style={styles.container}>
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <TouchableOpacity onPress={() => { setCurrentPath('/'); setLoading(true); }}>
          <Ionicons name="home-outline" size={18} color="#58a6ff" />
        </TouchableOpacity>
        <Text style={styles.pathText}>{currentPath}</Text>
        {currentPath !== '/' && (
          <TouchableOpacity onPress={goUp}>
            <Ionicons name="arrow-up-outline" size={18} color="#8b949e" />
          </TouchableOpacity>
        )}
      </View>

      {/* File list */}
      <FlatList
        data={displayEntries}
        keyExtractor={item => item.path || item.name}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => item.type === 'dir' ? toggleDir(item) : null}
          >
            <Ionicons
              name={getFileIcon(item.name, item.type)}
              size={18}
              color={item.type === 'dir' ? '#58a6ff' : '#8b949e'}
            />
            <Text style={[styles.itemName, item.type === 'dir' && styles.dirName]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.type === 'file' && item.size !== undefined && (
              <Text style={styles.itemSize}>{formatSize(item.size)}</Text>
            )}
            {item.type === 'dir' && (
              <Ionicons name="chevron-forward" size={14} color="#30363d" />
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={48} color="#30363d" />
            <Text style={styles.emptyText}>空目录</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDir(currentPath); }} tintColor="#58a6ff" />
        }
        contentContainerStyle={displayEntries.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b949e', marginTop: 8, fontSize: 13 },
  breadcrumb: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
    gap: 8,
  },
  pathText: { color: '#8b949e', fontSize: 13, flex: 1, fontFamily: 'monospace' },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#21262d',
    gap: 8,
  },
  itemName: { color: '#c9d1d9', fontSize: 14, flex: 1 },
  dirName: { color: '#58a6ff', fontWeight: '500' },
  itemSize: { color: '#484f58', fontSize: 12, marginRight: 4 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  emptyText: { color: '#484f58', fontSize: 14, marginTop: 8 },
});
