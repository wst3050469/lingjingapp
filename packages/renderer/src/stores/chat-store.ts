import { create } from 'zustand';
import type { AgentEventData, CodeReviewReport } from '../ipc/ipc-client';
import { estimateConversationTokens } from '../utils/token-estimator';
import { useAuthStore } from './auth-store';

export type ChatMode = 'ask' | 'agent' | 'experts' | 'research';

export interface AttachedImage {
  name: string;
  dataUrl: string;
  /** MIME type of the file, e.g. "image/png", "application/pdf", "text/plain" */
  mediaType?: string;
}

export interface CodeContext {
  code: string;
  filePath: string;
  language: string;
  startLine?: number;
  endLine?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: { name: string; args: Record<string, unknown>; result?: { content: string; isError?: boolean } }[];
  attachments?: { images?: AttachedImage[]; files?: string[] };
  metadata?: { type: 'code_review_report'; report: CodeReviewReport };
  timestamp: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamText: string;
  inputText: string;
  askUserRequest: { requestId: string; question: string } | null;
  currentConversationId: string | null;
  conversations: ConversationSummary[];

  // Chat mode
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;

  // Token usage
  lastUsage: { inputTokens: number; outputTokens: number } | null;
  setLastUsage: (usage: { inputTokens: number; outputTokens: number } | null) => void;

  // Context compression
  cumulativeTokens: number;
  maxContextTokens: number;
  conversationSummary: string | null;
  isCompacting: boolean;
  autoCompactEnabled: boolean;
  autoCompactThreshold: number; // percentage, e.g. 70 = 70%
  updateCumulativeTokens: () => void;
  setMaxContextTokens: (n: number) => void;
  setConversationSummary: (summary: string | null) => void;
  setAutoCompactEnabled: (enabled: boolean) => void;
  setAutoCompactThreshold: (percent: number) => void;
  compactChat: () => Promise<void>;
  autoCompactIfNeeded: () => Promise<void>;

  // Recommendations
  recommendations: string[];
  setRecommendations: (recs: string[]) => void;

  // Code context (selected code sent to chat)
  codeContext: CodeContext | null;
  setCodeContext: (ctx: CodeContext | null) => void;

  addMessage: (msg: ChatMessage) => void;
  updateToolResult: (toolName: string, result: { content: string; isError?: boolean }) => void;
  appendToolProgress: (toolName: string, text: string) => void;
  flushStreamText: () => void;
  setStreaming: (streaming: boolean) => void;
  appendStreamText: (text: string) => void;
  resetStreamText: () => void;
  setInputText: (text: string) => void;
  setAskUserRequest: (req: { requestId: string; question: string } | null) => void;
  clearMessages: () => void;

  createNewConversation: () => void;
  loadConversationList: (userId: number) => Promise<void>;
  loadConversation: (conversationId: string) => Promise<void>;
  saveCurrentConversation: (userId: number) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  renameConversation: (conversationId: string, newTitle: string) => Promise<void>;
  tryAutoRestoreSession: (userId: number) => Promise<void>;
}

let messageCounter = 0;

export function generateMessageId(): string {
  return `msg-${Date.now()}-${++messageCounter}`;
}

// ── Session Snapshot (cross-window context persistence) ──
const SESSION_KEY = 'lingjing_session_snapshot';

export interface SessionSnapshot {
  timestamp: number;
  conversationId: string | null;
  conversationTitle: string;
  conversationSummary: string | null;
  contextFiles: Array<{ id: string; type: string; label: string; path: string }>;
  lastWorkspace: string;
  messageCount: number;
  chatMode: ChatMode;
}

export function saveSessionSnapshot(chatStore: ChatState): void {
  const { messages, chatMode, conversationSummary, currentConversationId, conversations } = chatStore;
  if (!messages || messages.length === 0) {
    return;
  }

  // Extract chatContexts safely — errors here must NOT prevent snapshot save
  let chatContexts: any[] = [];
  try {
    const contextStore = (window as any).__contextStore?.getState?.();
    if (contextStore?.chatContexts) {
      chatContexts = contextStore.chatContexts;
    }
  } catch (ctxErr) {
    // contextStore not available or threw — non-critical, continue without contexts
  }

  try {
    const firstUserMsg = messages.find((m) => m.role === 'user');
    const title = conversations.find(c => c.id === currentConversationId)?.title
      || (firstUserMsg?.content?.slice(0, 50) || 'New Chat');

    const snapshot: SessionSnapshot = {
      timestamp: Date.now(),
      conversationId: currentConversationId,
      conversationTitle: title,
      conversationSummary,
      contextFiles: chatContexts.map((c: any) => ({
        id: c.id, type: c.type, label: c.label, path: c.path,
      })),
      lastWorkspace: '',
      messageCount: messages.length,
      chatMode,
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[ChatStore] Failed to save session snapshot:', err);
  }
}

export function loadSessionSnapshot(): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      console.log('[ChatStore] No session snapshot found in localStorage');
      return null;
    }
    const snapshot = JSON.parse(raw) as SessionSnapshot;
    // Expire after 48 hours
    if (Date.now() - snapshot.timestamp > 48 * 60 * 60 * 1000) {
      console.log('[ChatStore] Session snapshot expired (48h limit), clearing');
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    console.log('[ChatStore] Session snapshot loaded:', {
      conversationId: snapshot.conversationId,
      title: snapshot.conversationTitle,
      messageCount: snapshot.messageCount,
      age: Math.round((Date.now() - snapshot.timestamp) / 1000) + 's',
    });
    return snapshot;
  } catch (err) {
    console.warn('[ChatStore] Failed to parse session snapshot:', err);
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { console.warn('[ChatStore] Failed to remove session snapshot key:', e); }
    return null;
  }
}

export function clearSessionSnapshot(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    console.log('[ChatStore] Session snapshot cleared');
  } catch (err) { console.warn('[ChatStore] Failed to clear session snapshot:', err); }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  currentStreamText: '',
  inputText: '',
  askUserRequest: null,
  currentConversationId: null,
  conversations: [],

  chatMode: 'agent',
  setChatMode: (mode) => set({ chatMode: mode }),

  lastUsage: null,
  setLastUsage: (usage) => set({ lastUsage: usage }),

  cumulativeTokens: 0,
  maxContextTokens: 128000,
  conversationSummary: null,
  isCompacting: false,
  autoCompactEnabled: true,
  autoCompactThreshold: 70,

  updateCumulativeTokens: () => {
    const { messages } = get();
    set({ cumulativeTokens: estimateConversationTokens(messages) });
  },

  setMaxContextTokens: (n) => set({ maxContextTokens: n }),
  setConversationSummary: (summary) => set({ conversationSummary: summary }),
  setAutoCompactEnabled: (enabled) => set({ autoCompactEnabled: enabled }),
  setAutoCompactThreshold: (percent) => set({ autoCompactThreshold: percent }),

  /**
   * Auto-compact: silently check if compaction is needed and trigger it.
   * Called from useAgentEvents after each assistant response finishes (done event).
   */
  autoCompactIfNeeded: async () => {
    const { messages, isStreaming, isCompacting, autoCompactEnabled, autoCompactThreshold, cumulativeTokens, maxContextTokens } = get();
    if (!autoCompactEnabled || isStreaming || isCompacting) return;
    if (messages.length < 4 || cumulativeTokens < 2000) return;
    // Cap context window to prevent unreachable thresholds with large-context models
    // (mirrors Core layer's COMPACTION_MAX_CONTEXT = 200000)
    const effectiveMaxCtx = Math.min(maxContextTokens, 200000);
    const thresholdTokens = Math.floor(effectiveMaxCtx * (autoCompactThreshold / 100));
    if (cumulativeTokens < thresholdTokens) return;
    console.log(`[Chat] Auto-compact triggered: ${cumulativeTokens} tokens >= ${thresholdTokens} threshold`);
    await get().compactChat();
  },

  compactChat: async () => {
    const { messages, currentConversationId, isCompacting } = get();
    if (messages.length < 4 || isCompacting) return;

    set({ isCompacting: true });
    try {
      // Keep the last WORKING_WINDOW messages intact so the agent
      // can continue executing without needing a new user prompt.
      const WORKING_WINDOW = 4;
      const historyEnd = Math.max(0, messages.length - WORKING_WINDOW);
      const historyMessages = messages.slice(0, historyEnd);
      const workingMessages = messages.slice(historyEnd);

      // Only compress the history portion (older messages)
      const serialized = historyMessages.map((m) => ({ role: m.role, content: m.content }));
      const result = await window.electronAPI.compact.summarize(serialized);

      // Check conversation hasn't changed during compaction
      if (get().currentConversationId !== currentConversationId) return;

      if (result.error) {
        console.error('Compact chat failed:', result.error);
        return;
      }

      // Build compressed messages: summary (system) + working window
      const summaryMsg: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant' as const,
        content: `**[Conversation Summary]**\n\n${result.summary}`,
        timestamp: Date.now(),
      };

      set({
        conversationSummary: result.summary,
        messages: [summaryMsg, ...workingMessages],
        cumulativeTokens: result.estimatedTokens,
      });
    } catch (err) {
      console.error('Compact chat error:', err);
    } finally {
      set({ isCompacting: false });
    }
  },

  recommendations: [],
  setRecommendations: (recs) => set({ recommendations: recs }),

  codeContext: null,
  setCodeContext: (ctx) => set({ codeContext: ctx }),

  addMessage: (msg) => {
    set((state) => ({ messages: [...state.messages, msg] }));
    get().updateCumulativeTokens();
    // Auto-save after each message (always save, fallback to userId=1 for guest users)
    const { currentConversationId } = get();
    if (currentConversationId) {
      const { user } = useAuthStore.getState();
      const userId = user?.id ?? 0;
      get().saveCurrentConversation(userId).catch((err) => { console.warn('[ChatStore] saveCurrentConversation failed:', err); });
    }
  },

  updateToolResult: (toolName, result) => set((state) => {
    const msgs = [...state.messages];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === 'tool' && m.toolCalls?.[0]?.name === toolName && !m.toolCalls[0].result) {
        msgs[i] = {
          ...m,
          toolCalls: [{ ...m.toolCalls[0], result }],
        };
        break;
      }
    }
    return { messages: msgs };
  }),

  appendToolProgress: (toolName, text) => set((state) => {
    const msgs = [...state.messages];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === 'tool' && m.toolCalls?.[0]?.name === toolName && !m.toolCalls[0].result) {
        msgs[i] = {
          ...m,
          content: m.content + text,
        };
        break;
      }
    }
    return { messages: msgs };
  }),

  flushStreamText: () => {
    const { currentStreamText } = get();
    if (currentStreamText) {
      set((state) => ({
        messages: [...state.messages, {
          id: generateMessageId(),
          role: 'assistant' as const,
          content: currentStreamText,
          timestamp: Date.now(),
        }],
        currentStreamText: '',
      }));
      get().updateCumulativeTokens();
      // Auto-save after flush (always save, fallback to userId=1 for guest users)
      const { currentConversationId } = get();
      if (currentConversationId) {
        const { user } = useAuthStore.getState();
        const userId = user?.id ?? 0;
        get().saveCurrentConversation(userId).catch((err) => { console.warn('[ChatStore] saveCurrentConversation failed:', err); });
      }
    }
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),
  appendStreamText: (text) => set((state) => ({ currentStreamText: state.currentStreamText + text })),
  resetStreamText: () => set({ currentStreamText: '' }),
  setInputText: (text) => set({ inputText: text }),
  setAskUserRequest: (req) => set({ askUserRequest: req }),
  clearMessages: () => set({ messages: [], currentStreamText: '', cumulativeTokens: 0 }),

  createNewConversation: () => {
    const id = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    // If streaming, abort to prevent stale events
    if (get().isStreaming) {
      window.electronAPI.agent.abort().catch(() => {});
    }
    set({ currentConversationId: id, messages: [], currentStreamText: '', cumulativeTokens: 0, conversationSummary: null, isCompacting: false, isStreaming: false });
    window.electronAPI.agent.resetConversation().catch((err) => { console.warn('[ChatStore] resetConversation failed:', err); });
  },

  loadConversationList: async (userId: number) => {
    try {
      const list = await window.electronAPI.conversation.list(userId);
      set({ conversations: list });
    } catch (err) {
      console.error('Failed to load conversation list:', err);
    }
  },

  loadConversation: async (conversationId: string) => {
    try {
      // If streaming, abort first to prevent stale events polluting new conversation
      if (get().isStreaming) {
        try { await window.electronAPI.agent.abort(); } catch { /* ignore */ }
        set({ isStreaming: false, currentStreamText: '' });
      }
      const rawMessages = await window.electronAPI.conversation.load(conversationId);
      if (!rawMessages || rawMessages.length === 0) {
        set({ currentConversationId: conversationId, messages: [], currentStreamText: '', cumulativeTokens: 0, conversationSummary: null, isStreaming: false });
      } else {
        const messages: ChatMessage[] = rawMessages.map((m: any, i: number) => ({
          id: `loaded-${i}`,
          role: m.role as ChatMessage['role'],
          content: m.content,
          toolCalls: m.toolCalls,
          timestamp: Date.now(),
        }));
        set({ currentConversationId: conversationId, messages, currentStreamText: '', cumulativeTokens: 0, conversationSummary: null, isStreaming: false });
      }
      // Reset agent so next message creates a fresh agent for this conversation
      await window.electronAPI.agent.resetConversation().catch((err) => { console.warn('[ChatStore] resetConversation failed:', err); });
    } catch (err) {
      console.error(`Failed to load conversation ${conversationId}:`, err);
    }
  },

  saveCurrentConversation: async (userId: number) => {
    const { currentConversationId, messages, isStreaming } = get();

    if (!currentConversationId || messages.length === 0) {
      console.log('[ChatStore] Skipping save: empty conversation');
      return;
    }

    if (isStreaming) {
      console.warn('[ChatStore] Skipping save: streaming in progress');
      return;
    }

    const firstUserMsg = messages.find((m) => m.role === 'user');
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
      : 'New Chat';

    const serialized = messages.map((m) => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
    }));

    try {
      console.log('[ChatStore] Saving conversation:', currentConversationId, 'messages:', serialized.length);

      await window.electronAPI.conversation.save(userId, currentConversationId, title, serialized);
      console.log('[ChatStore] Database save completed');

      await get().loadConversationList(userId);

      saveSessionSnapshot(get());
      console.log('[ChatStore] Session snapshot saved');

      window.electronAPI.cloud?.pushSession?.({
        id: currentConversationId,
        title,
        messages: serialized,
        metadata: { chatMode: get().chatMode, messageCount: serialized.length },
      }).catch(() => { /* cloud may not be connected */ });

    } catch (err) {
      console.error('[ChatStore] Failed to save conversation:', err);

      try {
        saveSessionSnapshot(get());
        console.log('[ChatStore] Saved session snapshot as fallback');
      } catch (snapshotErr) {
        console.error('[ChatStore] Failed to save snapshot:', snapshotErr);
      }
    }
  },

  deleteConversation: async (conversationId: string) => {
    try {
      await window.electronAPI.conversation.delete(conversationId);
      const { currentConversationId } = get();
      // If deleting the active conversation, create a new one
      if (currentConversationId === conversationId) {
        get().createNewConversation();
      }
      // Refresh list (fallback to userId=1 for guest users)
      const { user } = useAuthStore.getState();
      const userId = user?.id ?? 0;
      await get().loadConversationList(userId);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  },

  renameConversation: async (conversationId: string, newTitle: string) => {
    try {
      await window.electronAPI.conversation.rename(conversationId, newTitle);
      // Refresh list (fallback to userId=1 for guest users)
      const { user } = useAuthStore.getState();
      const userId = user?.id ?? 0;
      await get().loadConversationList(userId);
    } catch (err) {
      console.error('Failed to rename conversation:', err);
    }
  },

  /**
   * Auto-restore the last session from session snapshot.
   * Called from App.tsx after auth restore and conversation list load.
   * Prioritizes snapshot's conversationId over most-recent from list.
   */
  tryAutoRestoreSession: async (userId: number) => {
    const { currentConversationId } = get();
    // Don't restore if already have an active conversation
    if (currentConversationId) {
      console.log('[ChatStore] Already have active conversation, skipping auto-restore:', currentConversationId);
      return;
    }

    try {
      // Load conversation list first
      console.log('[ChatStore] Loading conversation list for user', userId);
      await get().loadConversationList(userId);
    } catch (listErr) {
      console.warn('[ChatStore] Failed to load conversation list:', listErr);
    }

    // Try session snapshot first (most accurate recovery)
    const snapshot = loadSessionSnapshot();
    if (snapshot?.conversationId) {
      try {
        console.log('[ChatStore] Auto-restoring from session snapshot:', snapshot.conversationTitle);
        await get().loadConversation(snapshot.conversationId);
        if (snapshot.chatMode) {
          get().setChatMode(snapshot.chatMode);
        }
        // Only clear snapshot if we actually loaded messages
        const { messages: loadedMsgs } = get();
        if (loadedMsgs.length > 0) {
          console.log('[ChatStore] Session snapshot restored successfully (' + loadedMsgs.length + ' messages), clearing snapshot');
          clearSessionSnapshot();
          return; // ✅ only return when messages were actually loaded from DB
        } else {
          // 🔴 FIX: Reset currentConversationId so the fallback to most recent
          // conversation can proceed. loadConversation() sets currentConversationId
          // even when it loads 0 messages, which blocks the fallback.
          console.warn('[ChatStore] Session snapshot loaded 0 messages, resetting conversationId and falling back');
          set({ currentConversationId: null });
          clearSessionSnapshot();
        }
      } catch (err) {
        console.warn('[ChatStore] Session snapshot restore failed, falling back to list:', err);
        clearSessionSnapshot();
      }
    } else if (snapshot) {
      console.log('[ChatStore] Session snapshot exists but has no conversationId, skipping');
      clearSessionSnapshot();
    }

    // Fallback: restore most recent conversation from list
    const { conversations } = get();
    if (conversations.length > 0 && !get().currentConversationId) {
      const mostRecent = conversations[0];
      try {
        console.log('[ChatStore] Auto-restoring most recent conversation:', mostRecent.title);
        await get().loadConversation(mostRecent.id);
        // If loaded 0 messages, create new conversation instead
        if (get().messages.length === 0) {
          console.log('[ChatStore] Most recent conversation has 0 messages, creating new one');
          get().createNewConversation();
        }
      } catch (err) {
        console.warn('[ChatStore] Failed to load most recent conversation:', err);
        get().createNewConversation();
      }
    } else if (conversations.length === 0) {
      console.log('[ChatStore] No conversations found, creating new one');
      get().createNewConversation();
    }
  },
}));
