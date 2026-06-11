// 对话详情页
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Alert } from 'react-native';
import { api } from '../services/api';
import { useAppStore, Message } from '../stores/app-store';
import { Ionicons } from '@expo/vector-icons';

export default function ChatDetailScreen({ route }: any) {
  if (!route?.params) { return null; }
  const { sessionId, title } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { connected } = useAppStore();
  const flatListRef = useRef<FlatList>(null);
  const wsUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadSession();

    wsUnsubRef.current = api.subscribeWs((data) => {
      if (data.type === 'push' && data.channel === 'chat' && data.data?.conversationId === sessionId) {
        if (data.data?.message) {
          setMessages(prev => [...prev, data.data.message]);
        }
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    return () => { wsUnsubRef.current?.(); };
  }, [sessionId]);

  async function loadSession() {
    try {
      const data = await api.getSession(sessionId);
      setMessages(data.messages || []);
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
      let result: any = null;

      // Try WebSocket first (if connected)
      if (api.isConnected()) {
        try {
          await api.wsCommand('chat', 'send', { conversationId: sessionId, message: msg });
          setSending(false);
          return; // WebSocket will deliver reply via push
        } catch (wsErr) {
          console.log('[ChatDetail] WS failed, trying HTTP...');
        }
      }

      // HTTP fallback (works with cloud AI even without desktop)
      result = await api.sendMessage(sessionId, msg);

      // Handle cloud AI reply format: {reply, conversationId}
      if (result?.reply) {
        const aiMsg: Message = {
          role: 'assistant',
          content: result.reply,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } else if (result?.ok && result?.response) {
        // Desktop relay reply format
        let replyContent = typeof result.response === 'string'
          ? result.response
          : (result.response?.reply || result.response?.content || JSON.stringify(result.response));
        const aiMsg: Message = {
          role: 'assistant',
          content: replyContent,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);
      }

      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      console.log('Send failed:', e.message);
      if (e.message?.includes('unauthorized')) {
        Alert.alert('未授权', '请登录云账号后重试');
      } else if (e.message?.includes('network') || e.message?.includes('fetch')) {
        Alert.alert('网络错误', '无法连接到服务器，请检查网络连接');
      } else {
        // Cloud AI fallback error: show in chat
        const errMsg: Message = {
          role: 'assistant' as const,
          content: '❌ 消息发送失败: ' + (e.message || '未知错误'),
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
      }
    } finally {
      setSending(false);
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && <Ionicons name="hardware-chip-outline" size={18} color="#58a6ff" style={styles.msgIcon} />}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.bubbleText, isUser ? styles.userText : styles.aiText]}>
            {item.content}
          </Text>
          {item.tool_calls && (
            <View style={styles.toolCall}>
              <Ionicons name="hammer-outline" size={12} color="#d2a8ff" />
              <Text style={styles.toolText}>工具调用</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.center}><Text style={styles.loadingText}>加载中...</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderMessage}
          style={styles.msgList}
          contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.msgContent}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="chatbubble-outline" size={48} color="#30363d" />
              <Text style={{ color: '#484f58', marginTop: 8 }}>开始对话吧</Text>
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
            <Ionicons name="send" size={18} color="#fff" />
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
  msgList: { flex: 1 },
  msgContent: { padding: 12, paddingBottom: 20 },
  emptyContainer: { flex: 1 },
  messageRow: { flexDirection: 'row', marginBottom: 12 },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  msgIcon: { marginRight: 6, marginTop: 4 },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 10 },
  userBubble: { backgroundColor: '#1f6feb' },
  aiBubble: { backgroundColor: '#161b22', borderWidth: 1, borderColor: '#21262d' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: '#fff' },
  aiText: { color: '#c9d1d9' },
  toolCall: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  toolText: { color: '#d2a8ff', fontSize: 11 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 8,
    backgroundColor: '#161b22', borderTopWidth: 1, borderTopColor: '#21262d',
  },
  input: {
    flex: 1, color: '#c9d1d9', fontSize: 14,
    backgroundColor: '#0d1117', borderRadius: 10, padding: 10,
    maxHeight: 100, borderWidth: 1, borderColor: '#21262d',
  },
  sendBtn: {
    backgroundColor: '#1f6feb', borderRadius: 20,
    padding: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#21262d' },
});
