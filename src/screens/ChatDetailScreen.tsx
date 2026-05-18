// 对话详情页
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { api } from '../services/api';
import { useAppStore, Message } from '../stores/app-store';
import { Ionicons } from '@expo/vector-icons';

export default function ChatDetailScreen({ route }: any) {
  const { sessionId, title } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const { connected } = useAppStore();
  const flatListRef = useRef<FlatList>(null);
  const wsUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadSession();

    // Subscribe to real-time push for this conversation
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
    if (!input.trim()) return;
    const msg = input.trim();
    setInput('');

    // Optimistic insert
    const userMsg: Message = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      if (api.isConnected()) {
        await api.wsCommand('chat', 'send', { conversationId: sessionId, message: msg });
      } else {
        await api.sendMessage(sessionId, msg);
      }
    } catch (e) {
      console.log('Send failed:', e);
      // Show failed indicator
      setMessages(prev => prev.map(m => m === userMsg ? { ...m, role: 'system' as const, content: '发送失败: ' + msg } : m));
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
              <Text style={styles.toolCallText}>工具调用</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => `${index}`}
        renderItem={renderMessage}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="输入消息..."
            placeholderTextColor="#484f58"
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={22} color={input.trim() ? '#fff' : '#484f58'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  list: { flex: 1 },
  listContent: { padding: 12 },
  messageRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  userRow: { justifyContent: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  msgIcon: { marginRight: 6, marginBottom: 4 },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 12 },
  userBubble: { backgroundColor: '#1f6feb', alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: '#21262d', alignSelf: 'flex-start' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#fff' },
  aiText: { color: '#c9d1d9' },
  toolCall: { flexDirection: 'row', alignItems: 'center', marginTop: 6, padding: 4, backgroundColor: 'rgba(210,168,255,0.1)', borderRadius: 4 },
  toolCallText: { color: '#d2a8ff', fontSize: 12, marginLeft: 4 },
  inputBar: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#30363d', backgroundColor: '#161b22', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#0d1117', color: '#c9d1d9', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1, borderColor: '#30363d' },
  sendBtn: { marginLeft: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: '#1f6feb', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#21262d' },
});
