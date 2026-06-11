// 代码编辑器页 — 查看/编辑服务器文件
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const LANGUAGE_EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
  py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
  css: 'css', scss: 'scss', html: 'html', json: 'json',
  md: 'markdown', yml: 'yaml', yaml: 'yaml', sh: 'bash',
  sql: 'sql', xml: 'xml', c: 'c', cpp: 'cpp', h: 'c',
  lua: 'lua', toml: 'toml', ini: 'ini', dockerfile: 'dockerfile',
};

interface Props {
  route: { params: { filePath: string; fileName?: string } };
  navigation: any;
}

export default function CodeEditorScreen({ route, navigation }: Props) {
  const { filePath, fileName } = route.params;
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const [fileSize, setFileSize] = useState(0);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const ext = (fileName || filePath).split('.').pop()?.toLowerCase() || '';
  const lang = LANGUAGE_EXT[ext] || ext;

  const loadFile = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.readFile(filePath);
      setContent(result.content);
      setOriginalContent(result.content);
      setFileSize(result.size);
    } catch (e: any) {
      Alert.alert('加载失败', e.message || '无法读取文件');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [filePath, navigation]);

  useEffect(() => { loadFile(); }, [loadFile]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() => setShowLineNumbers(!showLineNumbers)}
            style={{ paddingHorizontal: 8 }}
          >
            <Ionicons
              name={showLineNumbers ? 'list-outline' : 'list'}
              size={20}
              color="#8b949e"
            />
          </TouchableOpacity>
          {edited && (
            <TouchableOpacity onPress={handleSave} disabled={saving} style={{ paddingHorizontal: 8 }}>
              {saving ? (
                <ActivityIndicator size="small" color="#3fb950" />
              ) : (
                <Ionicons name="save-outline" size={20} color="#3fb950" />
              )}
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [edited, saving, showLineNumbers]);

  async function handleSave() {
    try {
      setSaving(true);
      await api.writeFile(filePath, content);
      setOriginalContent(content);
      setEdited(false);
      Alert.alert('保存成功', `文件已保存: ${fileName || filePath}`);
    } catch (e: any) {
      Alert.alert('保存失败', e.message || '无法写入文件');
    } finally {
      setSaving(false);
    }
  }

  function handleContentChange(text: string) {
    setContent(text);
    setEdited(text !== originalContent);
  }

  const lines = content.split('\n');
  const lineCount = lines.length;
  const lineNumWidth = String(lineCount).length * 10 + 16;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#58a6ff" />
        <Text style={styles.loadingText}>正在加载文件...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* File info bar */}
      <View style={styles.infoBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="code-slash-outline" size={16} color="#58a6ff" />
          <Text style={styles.fileName} numberOfLines={1}>{fileName || filePath}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.langTag}>{lang}</Text>
          <Text style={styles.metaText}>{lines.length}行 · {formatSize(fileSize)}</Text>
          {edited && <Text style={styles.editedTag}>已修改</Text>}
        </View>
      </View>

      {/* Code area */}
      <ScrollView horizontal style={styles.hScroll}>
        <ScrollView style={styles.vScroll}>
          <View style={{ flexDirection: 'row' }}>
            {showLineNumbers && (
              <View style={[styles.lineNumbers, { width: lineNumWidth }]}>
                {lines.map((_, i) => (
                  <Text key={i} style={styles.lineNum}>{i + 1}</Text>
                ))}
              </View>
            )}
            <TextInput
              style={[styles.codeInput, { minHeight: Math.max(SCREEN_HEIGHT * 0.7, lineCount * 22) }]}
              value={content}
              onChangeText={handleContentChange}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              scrollEnabled={false}
            />
          </View>
        </ScrollView>
      </ScrollView>

      {/* Bottom toolbar */}
      {edited && (
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.discardBtn}
            onPress={() => {
              Alert.alert('放弃修改', '确定要放弃所有修改吗？', [
                { text: '取消', style: 'cancel' },
                { text: '放弃', style: 'destructive', onPress: () => {
                  setContent(originalContent);
                  setEdited(false);
                }},
              ]);
            }}
          >
            <Ionicons name="close-outline" size={18} color="#f85149" />
            <Text style={styles.discardText}>放弃</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Ionicons name="checkmark-outline" size={18} color="#fff" />
            <Text style={styles.saveText}>{saving ? '保存中...' : '保存'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b949e', marginTop: 8, fontSize: 13 },
  infoBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
  },
  fileName: { color: '#c9d1d9', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  langTag: {
    color: '#58a6ff', fontSize: 11,
    backgroundColor: '#1c2a3d', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
  },
  metaText: { color: '#484f58', fontSize: 11 },
  editedTag: { color: '#d29922', fontSize: 11, fontWeight: '600' },
  hScroll: { flex: 1 },
  vScroll: { flex: 1 },
  lineNumbers: {
    backgroundColor: '#161b22', paddingTop: 4,
    borderRightWidth: 1, borderRightColor: '#21262d',
    alignItems: 'flex-end', paddingRight: 8,
  },
  lineNum: {
    color: '#484f58', fontSize: 12, fontFamily: 'monospace',
    lineHeight: 22, height: 22, textAlign: 'right',
  },
  codeInput: {
    flex: 1, color: '#c9d1d9', fontSize: 13, fontFamily: 'monospace',
    paddingHorizontal: 12, paddingTop: 4, lineHeight: 22,
    backgroundColor: '#0d1117',
  },
  toolbar: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 8,
    padding: 10, backgroundColor: '#161b22',
    borderTopWidth: 1, borderTopColor: '#21262d',
  },
  discardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 6, borderWidth: 1, borderColor: '#f85149',
  },
  discardText: { color: '#f85149', fontSize: 14 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: '#238636', borderRadius: 6,
  },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
