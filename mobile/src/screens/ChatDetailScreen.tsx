// 对话详情页 — 云AI直连 + 模型选择 + Action Bar（任务控制·文件上传·语音输入·润色）
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, SafeAreaView, Alert, ActivityIndicator, PermissionsAndroid,
} from 'react-native';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../services/api';
import { useAppStore, Message } from '../stores/app-store';
import { Ionicons } from '@expo/vector-icons';

// ── 模型列表 ──
const MODELS = [
  { id: 'deepseek', name: 'DeepSeek', icon: 'bulb-outline' },
  { id: 'thinking', name: '深度思考', icon: 'git-branch-outline' },
];

// ── 任务状态枚举 ──
type TaskStatus = 'idle' | 'running' | 'paused' | 'stopped';

export default function ChatDetailScreen({ route }: any) {
  const sessionId = route?.params?.sessionId;
  const title = route?.params?.title;

  // ── 防御性检查：缺少 sessionId 时显示错误 ──
  if (!sessionId) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>❌ 无效的会话 ID</Text>
      </View>
    );
  }

  // ── 对话状态 ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('deepseek');
  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // ── 任务控制状态 ──
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('idle');
  const [recording, setRecording] = useState(false);
  const [polishing, setPolishing] = useState(false);

  // ── 加载会话 ──
  useEffect(() => { loadSession(); }, [sessionId]);

  // ── 监听 WebSocket 任务状态变更 ──
  useEffect(() => {
    const unsub = api.onTaskStatusChange?.((newStatus: TaskStatus) => {
      setTaskStatus(newStatus);
    });
    return () => { unsub?.(); };
  }, [sessionId]);

  async function loadSession() {
    try {
      const data = await api.getSession(sessionId);
      if (data?.messages) setMessages(data.messages);
      if (data?.taskStatus) setTaskStatus(data.taskStatus);
    } catch (e) {
      console.log('Failed to load session:', e);
    } finally {
      setLoading(false);
    }
  }

  // ── 发送消息 ──
  async function handleSend() {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    const userMsg: Message = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      let result: any;
      if (selectedModel === 'thinking') {
        const thinkingMsg: Message = {
          role: 'assistant' as const,
          content: '深度思考中...',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, thinkingMsg]);
        result = await api.sendMessage(sessionId, '请逐步思考后回答：' + msg);
        setMessages(prev => {
          const filtered = prev.filter(m => m !== thinkingMsg);
          return [...filtered, {
            role: 'assistant' as const,
            content: result?.reply || '思考完毕',
            created_at: new Date().toISOString(),
          }];
        });
      } else {
        result = await api.sendMessage(sessionId, msg);
        if (result?.reply) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: result.reply,
            created_at: new Date().toISOString(),
          }]);
        }
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // ── 同步到服务器会话列表（电脑端可见）──
      try {
        const allMessages = [...messages, userMsg].map(m => ({
          role: m.role, content: m.content, created_at: m.created_at,
        }));
        if (result?.reply) {
          allMessages.push({ role: 'assistant', content: result.reply, created_at: new Date().toISOString() });
        }
        await api.upsertSession({
          id: sessionId,
          title: title || msg.slice(0, 30),
          messages: allMessages,
        });
      } catch (syncErr: any) {
        console.log('Session sync skipped:', syncErr.message);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant' as const,
        content: '❌ ' + (e.message || '发送失败'),
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  }

  // ── 任务控制 ──
  async function handleTaskControl(action: 'pause' | 'resume' | 'stop') {
    try {
      await api.controlTask(sessionId, action);
      // 乐观更新 UI
      if (action === 'pause') setTaskStatus('paused');
      if (action === 'resume') setTaskStatus('running');
      if (action === 'stop') setTaskStatus('stopped');
    } catch (e: any) {
      Alert.alert('操作失败', e.message || '无法执行任务控制');
    }
  }

  // ── 文件上传 ──
  async function handlePickFile() {
    try {
      const result = await DocumentPicker.pick({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.length) {
        const file = result.assets[0];
        await api.uploadFile(sessionId, {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
        });
        setMessages(prev => [...prev, {
          role: 'user',
          content: `[文件] ${file.name}`,
          created_at: new Date().toISOString(),
        }]);
      }
    } catch (e: any) {
      Alert.alert('上传失败', e.message || '未知错误');
    }
  }

  // ── 润色提示词 ──
  async function handlePolish() {
    if (!input.trim() || polishing) return;
    setPolishing(true);
    try {
      const result = await api.polishPrompt(input.trim());
      if (result?.polished) {
        setInput(result.polished);
      }
    } catch (e: any) {
      Alert.alert('润色失败', e.message || '无法润色提示词');
    } finally {
      setPolishing(false);
    }
  }

  // ── 语音输入 ──
  async function handleVoiceInput() {
    if (recording) {
      // 停止录音并发送
      setRecording(false);
      try {
        const rec = recordingRef.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        recordingRef.current = null;
        if (uri) {
          const text = await api.transcribeAudio(uri);
          if (text) setInput(prev => prev + text);
        }
      } catch (e: any) {
        recordingRef.current = null;
        Alert.alert('语音识别失败', e.message || '未知错误');
      }
    } else {
      // Android 权限请求
      if (Platform.OS === 'android') {
        try {
          const perm = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            { title: '录音权限', message: '灵境AI需要使用麦克风进行语音输入', buttonPositive: '允许', buttonNegative: '拒绝' }
          );
          if (perm !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert('权限被拒绝', '请在系统设置中允许灵境AI使用麦克风');
            return;
          }
        } catch (e: any) {
          Alert.alert('权限错误', e.message);
          return;
        }
      }
      // 开始录音
      setRecording(true);
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        await rec.startAsync();
        recordingRef.current = rec;
      } catch (e: any) {
        setRecording(false);
        recordingRef.current = null;
        Alert.alert('录音失败', e.message || '未知错误');
      }
    }
  }

  // ── 渲染消息 ──
  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && <Ionicons name="hardware-chip-outline" size={18} color="#58a6ff" style={styles.msgIcon} />}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  // ── 任务控制按钮是否可用 ──
  const canPause = taskStatus === 'running';
  const canResume = taskStatus === 'paused';
  const canStop = taskStatus === 'running' || taskStatus === 'paused';

  if (loading) {
    return <View style={styles.center}><Text style={styles.loadingText}>加载中...</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>

        {/* ── 模型选择器 ── */}
        <View style={styles.modelBar}>
          {MODELS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.modelBtn, selectedModel === m.id && styles.modelBtnActive]}
              onPress={() => setSelectedModel(m.id)}
            >
              <Ionicons name={m.icon as any} size={14} color={selectedModel === m.id ? '#fff' : '#8b949e'} />
              <Text style={[styles.modelText, selectedModel === m.id && styles.modelTextActive]}>
                {m.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 消息列表 ── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderMessage}
          style={styles.list}
          contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="chatbubble-outline" size={48} color="#30363d" />
              <Text style={styles.emptyText}>开始对话吧</Text>
            </View>
          }
        />

        {/* ══════ Action Bar（任务控制 + 文件上传 + 语音输入）══════ */}
        <View style={styles.actionBar}>
          {/* 左侧：任务控制 */}
          <View style={styles.taskControls}>
            <TouchableOpacity
              style={[styles.controlBtn, canPause && styles.controlBtnActivePause]}
              disabled={!canPause}
              onPress={() => handleTaskControl('pause')}
            >
              <Ionicons name="pause" size={18} color={canPause ? '#ffb02e' : '#484f58'} />
              <Text style={[styles.controlLabel, canPause && styles.controlLabelActive]}>暂停</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, canResume && styles.controlBtnActiveResume]}
              disabled={!canResume}
              onPress={() => handleTaskControl('resume')}
            >
              <Ionicons name="play" size={18} color={canResume ? '#3fb950' : '#484f58'} />
              <Text style={[styles.controlLabel, canResume && styles.controlLabelActive]}>继续</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, canStop && styles.controlBtnActiveStop]}
              disabled={!canStop}
              onPress={() => handleTaskControl('stop')}
            >
              <Ionicons name="stop" size={18} color={canStop ? '#f85149' : '#484f58'} />
              <Text style={[styles.controlLabel, canStop && styles.controlLabelActive]}>停止</Text>
            </TouchableOpacity>
          </View>

          {/* 右侧：润色 + 文件上传 + 语音输入 */}
          <View style={styles.extraControls}>
            <TouchableOpacity
              style={[styles.extraBtn, polishing && styles.extraBtnPolishActive]}
              onPress={handlePolish}
              disabled={polishing || !input.trim()}
            >
              {polishing ? (
                <ActivityIndicator size="small" color="#d2a8ff" />
              ) : (
                <Ionicons name="sparkles" size={20} color={input.trim() ? '#d2a8ff' : '#484f58'} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.extraBtn} onPress={handlePickFile}>
              <Ionicons name="attach" size={20} color="#8b949e" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.extraBtn, recording && styles.extraBtnActive]}
              onPress={handleVoiceInput}
            >
              <Ionicons name="mic" size={20} color={recording ? '#f85149' : '#8b949e'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 输入栏 ── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="输入消息..."
            placeholderTextColor="#484f58"
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  center: { flex: 1, backgroundColor: '#0d1117', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#8b949e', fontSize: 14 },

  // ── 模型选择器 ──
  modelBar: {
    flexDirection: 'row', padding: 6, gap: 6,
    backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d',
    justifyContent: 'center',
  },
  modelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#21262d',
  },
  modelBtnActive: { backgroundColor: '#1f6feb' },
  modelText: { color: '#8b949e', fontSize: 12 },
  modelTextActive: { color: '#fff', fontWeight: '600' },

  // ── 消息列表 ──
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 20 },
  emptyContainer: { flex: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#484f58', marginTop: 8 },

  // ── 消息气泡 ──
  msgRow: { flexDirection: 'row', marginBottom: 12 },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  msgIcon: { marginRight: 6, marginTop: 4 },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 10 },
  userBubble: { backgroundColor: '#1f6feb' },
  aiBubble: { backgroundColor: '#161b22', borderWidth: 1, borderColor: '#21262d' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff' },
  aiText: { color: '#c9d1d9' },

  // ══════ Action Bar ══════
  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#21262d',
  },
  taskControls: { flexDirection: 'row', gap: 8 },
  controlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: '#21262d',
  },
  controlBtnActivePause: { backgroundColor: '#3d2e00' },
  controlBtnActiveResume: { backgroundColor: '#0d3320' },
  controlBtnActiveStop: { backgroundColor: '#3d1518' },
  controlLabel: { color: '#484f58', fontSize: 11, fontWeight: '500' },
  controlLabelActive: { color: '#c9d1d9' },

  extraControls: { flexDirection: 'row', gap: 12 },
  extraBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#21262d', alignItems: 'center', justifyContent: 'center',
  },
  extraBtnActive: { backgroundColor: '#3d1518' },
  extraBtnPolishActive: { backgroundColor: '#2d1f3d' },

  // ── 输入栏 ──
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 8,
    backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#21262d',
  },
  input: {
    flex: 1, color: '#c9d1d9', fontSize: 14,
    backgroundColor: '#0d1117', borderRadius: 10, padding: 10, maxHeight: 100,
    borderWidth: 1, borderColor: '#21262d',
  },
  sendBtn: {
    backgroundColor: '#1f6feb', borderRadius: 20,
    padding: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#21262d' },
});
