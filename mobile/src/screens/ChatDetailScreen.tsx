// 对话详情页 — 云AI直连 + 模型选择
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { api } from '../services/api';
import { useAppStore, Message } from '../stores/app-store';
import { Ionicons } from '@expo/vector-icons';

const MODELS = [
  { id: 'deepseek', name: 'DeepSeek', icon: 'bulb-outline' },
  { id: 'thinking', name: '深度思考', icon: 'git-branch-outline' },
];

export default function ChatDetailScreen({ route }: any) {
  if (!route?.params) { return null; }
  const { sessionId, title } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('deepseek');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => { loadSession(); }, [sessionId]);

  async function loadSession() {
    try {
      const data = await api.getSession(sessionId);
      if (data?.messages) setMessages(data.messages);
    } catch (e) {
      console.log('Failed to load session:', e);
    } finally {
      setLoading(false);
    }
  }

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
        // Show thinking indicator
        const thinkingMsg: Message = {
          role: 'assistant' as const,
          content: '🤔 深度思考中...',
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, thinkingMsg]);

        result = await api.sendMessage(sessionId, '请逐步思考后回答：' + msg);

        // Remove thinking indicator and add real reply
        setMessages(prev => {
          const filtered = prev.filter(m => m !== thinkingMsg);
          const aiMsg: Message = {
            role: 'assistant' as const,
            content: result?.reply || '思考完毕',
            created_at: new Date().toISOString(),
          };
          return [...filtered, aiMsg];
        });
      } else {
        result = await api.sendMessage(sessionId, msg);
        if (result?.reply) {
          const aiMsg: Message = {
            role: 'assistant',
            content: result.reply,
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, aiMsg]);
        }
      }

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      const errMsg: Message = {
        role: 'assistant' as const,
        content: '❌ ' + (e.message || '发送失败'),
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  }

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

  if (loading) {
    return <View style={styles.center}><Text style={styles.loadingText}>加载中...</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Model selector */}
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
  modelBar: { flexDirection: 'row', padding: 6, gap: 6, backgroundColor: '#161b22', borderBottomWidth: 1, borderBottomColor: '#21262d', justifyContent: 'center' },
  modelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#21262d' },
  modelBtnActive: { backgroundColor: '#1f6feb' },
  modelText: { color: '#8b949e', fontSize: 12 },
  modelTextActive: { color: '#fff', fontWeight: '600' },
  list: { flex: 1 },
  listContent: { padding: 12, paddingBottom: 20 },
  emptyContainer: { flex: 1 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#484f58', marginTop: 8 },
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
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 8, backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#21262d' },
  input: { flex: 1, color: '#c9d1d9', fontSize: 14, backgroundColor: '#0d1117', borderRadius: 10, padding: 10, maxHeight: 100, borderWidth: 1, borderColor: '#21262d' },
  sendBtn: { backgroundColor: '#1f6feb', borderRadius: 20, padding: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: '#21262d' },
});
