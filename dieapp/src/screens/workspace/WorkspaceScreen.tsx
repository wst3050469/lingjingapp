// 工作区 - AI 对话主界面
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../stores/app-store';
import { api } from '../../services/api';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

interface Message {
  id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number;
}

export default function WorkspaceScreen() {
  const { activeSessionId, activeSessionTitle } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: '你好！我是灵境 AI 编程助手。我可以帮你编写代码、调试问题、审查代码等。请告诉我你需要什么帮助？', timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim(); if (!text || sending) return;
    setSending(true);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]); setInput('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // 尝试发送到后端
    if (activeSessionId) {
      try {
        const res = await api.sendMessage(activeSessionId, text);
        if (res.ok && res.data) {
          const data = res.data as any;
          const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.content || '收到你的消息', timestamp: Date.now() };
          setMessages(prev => [...prev, aiMsg]);
        }
      } catch {}
    }
    // 模拟AI回复
    setTimeout(() => {
      const mockMsg: Message = { id: (Date.now() + 2).toString(), role: 'assistant', content: `收到你的消息：「${text}」\n\n这是一个模拟回复。在真实环境中，这里会显示 AI 助手的智能回复，支持 Markdown 格式、代码高亮和 Diff 预览。`, timestamp: Date.now() };
      setMessages(prev => [...prev, mockMsg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1000);
    setSending(false);
  }, [input, sending, activeSessionId]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.msgRow, isUser ? s.msgUser : s.msgAi]}>
        {!isUser && <View style={s.avatar}><Ionicons name="flash" size={16} color={Colors.dark.primary} /></View>}
        <View style={[s.bubble, isUser ? s.bubUser : s.bubAi]}>
          <Text style={[s.bubText, isUser && { color: '#fff' }]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {/* 顶部栏 */}
      <View style={s.header}>
        <Text style={s.title} numberOfLines={1}>{activeSessionTitle || '工作区'}</Text>
        <TouchableOpacity><Ionicons name="ellipsis-horizontal" size={22} color={Colors.dark.textSecondary} /></TouchableOpacity>
      </View>

      {/* 消息列表 */}
      {activeSessionId ? (
        <FlatList ref={flatListRef} data={messages} renderItem={renderMessage} keyExtractor={m => m.id}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })} />
      ) : (
        <View style={s.empty}>
          <Ionicons name="chatbubbles" size={48} color={Colors.dark.textTertiary} />
          <Text style={s.emptyTitle}>选择或创建一个会话</Text>
          <Text style={s.emptyDesc}>在任务页面创建新任务后，即可在此开始 AI 对话</Text>
        </View>
      )}

      {/* 输入栏 */}
      <View style={s.composer}>
        <TouchableOpacity style={s.attachBtn}><Ionicons name="add-circle-outline" size={24} color={Colors.dark.textSecondary} /></TouchableOpacity>
        <TextInput style={s.input} placeholder="输入消息或按住说话…" placeholderTextColor={Colors.dark.textTertiary}
          value={input} onChangeText={setInput} multiline maxLength={4000}
          onSubmitEditing={sendMessage} returnKeyType="send" blurOnSubmit />
        <TouchableOpacity style={[s.sendBtn, (!input.trim() || sending) && s.sendDisabled]} onPress={sendMessage} disabled={!input.trim() || sending}>
          <Ionicons name="send" size={20} color={input.trim() && !sending ? '#fff' : Colors.dark.textTertiary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.dark.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  title: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600', flex: 1 },
  list: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  msgUser: { justifyContent: 'flex-end' }, msgAi: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.dark.primaryBg, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bubble: { maxWidth: '78%', borderRadius: BR.lg, padding: 12 },
  bubUser: { backgroundColor: Colors.dark.primary, borderBottomRightRadius: 4 },
  bubAi: { backgroundColor: Colors.dark.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.dark.border },
  bubText: { color: Colors.dark.text, fontSize: FS.md, lineHeight: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyTitle: { color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600' },
  emptyDesc: { color: Colors.dark.textSecondary, fontSize: FS.sm, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: Colors.dark.border, backgroundColor: Colors.dark.surface, gap: 8 },
  attachBtn: { padding: 4 },
  input: { flex: 1, backgroundColor: Colors.dark.bg, borderRadius: BR.lg, borderWidth: 1, borderColor: Colors.dark.border, color: Colors.dark.text, fontSize: FS.md, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { backgroundColor: Colors.dark.surface2 },
});
