// Quest Mode Store - independent state management for autonomous programming tasks

import { create } from 'zustand';
import { useTodoStore } from './todo-store';
import { useQuestDiffStore } from './quest-diff-store';
import { estimateConversationTokens } from '../utils/token-estimator';

/** Safe JSON parse — handles case where value is already an object (e.g., from IPC) */
function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return val as unknown as T;
}


export interface QuestTask {
  id: string;
  title: string;
  scenario: 'spec' | 'prototype' | 'tool';
  runMode: 'local' | 'worktree' | 'remote';
  autoMode: 'auto' | 'manual';
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  specContent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolCalls?: { name: string; args: Record<string, unknown>; result?: { content: string; isError?: boolean } }[];
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export type ArtifactTab = 'spec' | 'files' | 'preview';
export type SpecStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface QuestState {
  // Task management
  tasks: QuestTask[];
  activeTaskId: string | null;
  runningTaskIds: string[];

  // Messages for active task
  messages: QuestMessage[];
  isStreaming: boolean;
  currentStreamText: string;

  // Run epoch tracking — discriminates stale events from old runs
  activeRunId: string | null;

  // Spec
  specContent: string | null;
  specStatus: SpecStatus;

  // Artifacts panel
  activeArtifactTab: ArtifactTab;
  previewUrl: string;

  // Ask user / confirmation (quest-scoped)
  askUserRequest: { requestId: string; question: string } | null;
  confirmRequest: {
    requestId: string;
    type: 'bash' | 'mcp' | 'plan';
    toolName: string;
    args: Record<string, unknown>;
    command?: string;
    planContent?: string;
    planTitle?: string;
  } | null;

  // Actions - task management
  createTask: (scenario: QuestTask['scenario'], runMode: QuestTask['runMode'], autoMode: QuestTask['autoMode'], title?: string) => Promise<string | null>;
  loadTaskList: () => Promise<void>;
  switchTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  setTaskStatus: (taskId: string, status: QuestTask['status']) => void;
  updateTaskTitle: (taskId: string, title: string) => void;

  // Actions - messages
  addMessage: (msg: QuestMessage) => void;
  appendStreamText: (text: string) => void;
  flushStreamText: () => void;
  setStreaming: (val: boolean) => void;
  resetStreamText: () => void;
  updateToolResult: (toolName: string, result: { content: string; isError?: boolean }) => void;
  appendToolProgress: (toolName: string, text: string) => void;

  // Actions - spec
  setSpecContent: (md: string | null) => void;
  setSpecStatus: (status: SpecStatus) => void;
  updateTaskSpec: (taskId: string, specContent: string) => void;

  // Actions - artifacts
  setActiveArtifactTab: (tab: ArtifactTab) => void;
  setPreviewUrl: (url: string) => void;

  // Actions - ask user / confirmation
  setAskUserRequest: (req: { requestId: string; question: string } | null) => void;
  setConfirmRequest: (req: QuestState['confirmRequest']) => void;

  // Actions - running tasks
  addRunningTask: (taskId: string) => void;
  removeRunningTask: (taskId: string) => void;

  // Actions - run epoch
  setActiveRunId: (runId: string | null) => void;

  // Context / compaction
  cumulativeTokens: number;
  maxContextTokens: number;
  isCompacting: boolean;
  autoCompactEnabled: boolean;
  autoCompactThreshold: number; // percentage, e.g. 70 = 70%
  updateCumulativeTokens: () => void;
  setMaxContextTokens: (n: number) => void;
  setAutoCompactEnabled: (enabled: boolean) => void;
  setAutoCompactThreshold: (percent: number) => void;
  compactQuest: () => Promise<void>;
  autoCompactIfNeeded: () => Promise<void>;
}

let questMsgCounter = 0;

export function generateQuestMessageId(): string {
  return `qmsg-${Date.now()}-${++questMsgCounter}`;
}

export const useQuestStore = create<QuestState>((set, get) => ({
  tasks: [],
  activeTaskId: null,
  runningTaskIds: [],

  messages: [],
  isStreaming: false,
  currentStreamText: '',

  activeRunId: null,

  specContent: null,
  specStatus: 'none' as SpecStatus,

  activeArtifactTab: 'spec',
  previewUrl: '',

  askUserRequest: null,
  confirmRequest: null,

  // --- Task management ---

  createTask: async (scenario, runMode, autoMode, title) => {
    try {
      console.log('[Quest] Creating task:', { scenario, runMode, autoMode });
      
      const result = await window.electronAPI.quest.createTask({
        scenario,
        runMode,
        autoMode,
        title: title || undefined,
      });
      console.log('[Quest] Create task result:', result);
      if (result?.id) {
        const task: QuestTask = {
          id: result.id,
          title: result.title || 'New Quest',
          scenario,
          runMode,
          autoMode,
          status: 'idle',
          specContent: null,
          createdAt: result.createdAt || new Date().toISOString(),
          updatedAt: result.updatedAt || new Date().toISOString(),
        };
        // Clear per-task state for the new task
        useQuestDiffStore.getState().clearReview();
        set((s) => ({
          tasks: [task, ...s.tasks],
          activeTaskId: task.id,
          messages: [],
          currentStreamText: '',
          specContent: null,
          specStatus: 'none' as SpecStatus,
        }));
        return task.id;
      }
      // Show detailed error from backend if available
      if (result?.error) {
        console.error('[Quest] Create task failed with error:', result.error);
      } else {
        console.error('[Quest] Create task failed: no id in result', result);
      }
      return null;
    } catch (err) {
      console.error('[Quest] Failed to create quest task:', err);
      return null;
    }
  },

  loadTaskList: async () => {
    try {
      const list = await window.electronAPI.quest.listTasks();
      const tasks: QuestTask[] = (list || []).map((t: any) => ({
        id: t.id,
        title: t.title || 'Untitled',
        scenario: t.scenario || 'spec',
        runMode: t.run_mode || 'local',
        autoMode: t.auto_mode || 'auto',
        status: t.status || 'idle',
        specContent: t.spec_content || null,
        createdAt: t.created_at || '',
        updatedAt: t.updated_at || '',
      }));
      set({ tasks });
    } catch {
      // ignore
    }
  },

  switchTask: async (taskId) => {
    const { activeTaskId, runningTaskIds, activeRunId } = get();
    // Clicking the already-active task is a no-op (do NOT reset streaming state)
    if (activeTaskId === taskId) {
      return;
    }

    // ★ Fix H: Save current streaming text before switching
    const currentState = get();
    if (currentState.currentStreamText && activeTaskId) {
      // Flush the stream text to messages first
      set((s) => ({
        messages: [...s.messages, {
          id: generateQuestMessageId(),
          role: 'assistant' as const,
          content: s.currentStreamText,
          timestamp: Date.now(),
        }],
        currentStreamText: '',
      }));
      // Save immediately
      try {
        await window.electronAPI.quest.saveMessages(activeTaskId);
      } catch {}
    }

    // If the current task has a running agent, stop it cleanly before switching
    if (activeTaskId && runningTaskIds.includes(activeTaskId)) {
      try {
        await window.electronAPI.quest.stopOnSwitch(activeTaskId, activeRunId || undefined);
      } catch { /* ignore */ }
    }
    set({
      activeTaskId: taskId,
      messages: [],
      currentStreamText: '',
      isStreaming: false,
      activeRunId: null,
    });

    // Load task messages from DB with timeout
    const loadMessages = async (): Promise<QuestMessage[]> => {
      const TIMEOUT_MS = 10000;
      const result = await Promise.race([
        window.electronAPI.quest.loadTask(taskId),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('loadTask timeout')), TIMEOUT_MS)
        ),
      ]);
      if (!result) return [];
      return (result as any[]).map((m: any, i: number) => ({
        id: `qloaded-${i}`,
        role: m.role,
        content: m.content,
        toolCalls: safeJsonParse(m.tool_calls, undefined),
        metadata: safeJsonParse(m.metadata, undefined),
        timestamp: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
      }));
    };

    try {
      const messages = await loadMessages();
      // Find task to load spec
      const task = get().tasks.find((t) => t.id === taskId);
      set({
        messages,
        specContent: task?.specContent || null,
        specStatus: 'none' as SpecStatus,
      });
      if (messages.length === 0) {
        console.warn(`No messages found for quest task ${taskId}`);
      }
    } catch (err) {
      console.error(`Failed to load quest task ${taskId}:`, err);
      // Set empty messages on failure so UI is not stuck
      if (get().activeTaskId === taskId) {
        set({ messages: [] });
      }
    }
  },

  deleteTask: async (taskId) => {
    try {
      await window.electronAPI.quest.deleteTask(taskId);
      set((s) => {
        const tasks = s.tasks.filter((t) => t.id !== taskId);
        const isActive = s.activeTaskId === taskId;
        return {
          tasks,
          ...(isActive ? {
            activeTaskId: null,
            messages: [],
            currentStreamText: '',
            specContent: null,
          } : {}),
          runningTaskIds: s.runningTaskIds.filter((id) => id !== taskId),
        };
      });
    } catch (err) {
      console.error('Failed to delete quest task:', err);
    }
  },

  setTaskStatus: (taskId, status) => set((s) => ({
    tasks: s.tasks.map((t) => t.id === taskId ? { ...t, status } : t),
  })),

  updateTaskTitle: (taskId, title) => {
    set((s) => ({
      tasks: s.tasks.map((t) => t.id === taskId ? { ...t, title } : t),
    }));
    // Persist to DB
    window.electronAPI.quest.renameTask(taskId, title).catch((err) => { console.warn('[QuestStore] renameTask failed:', err); });
  },

  // --- Messages ---

  addMessage: (msg) => {
    set((s) => ({ messages: [...s.messages, msg] }));
    get().updateCumulativeTokens();
    // Auto-save after each message
    const { activeTaskId } = get();
    if (activeTaskId) {
      window.electronAPI.quest.saveMessages(activeTaskId).catch((err) => { console.warn('[QuestStore] saveMessages failed:', err); });
    }
  },

  appendStreamText: (text) => {
    set((s) => ({
      currentStreamText: s.currentStreamText + text,
    }));
    // ★ Fix G: Real-time streaming persistence - periodically flush streaming
    // text to prevent data loss on crash. Only save every ~200 chars to avoid
    // excessive DB writes during fast streaming.
    const store = get();
    if (store.currentStreamText.length > 0 && store.currentStreamText.length % 200 < 20) {
      const taskId = store.activeTaskId;
      if (taskId) {
        window.electronAPI.quest.saveMessages(taskId).catch(() => {});
      }
    }
  },

  flushStreamText: () => {
    const { currentStreamText } = get();
    if (currentStreamText) {
      set((s) => ({
        messages: [...s.messages, {
          id: generateQuestMessageId(),
          role: 'assistant' as const,
          content: currentStreamText,
          timestamp: Date.now(),
        }],
        currentStreamText: '',
      }));
      // Auto-save after flush
      const { activeTaskId } = get();
      if (activeTaskId) {
        window.electronAPI.quest.saveMessages(activeTaskId).catch((err) => { console.warn('[QuestStore] saveMessages failed:', err); });
      }
    }
  },

  setStreaming: (val) => set({ isStreaming: val }),
  resetStreamText: () => set({ currentStreamText: '' }),

  updateToolResult: (toolName, result) => set((s) => {
    const msgs = [...s.messages];
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

  appendToolProgress: (toolName, text) => set((s) => {
    const msgs = [...s.messages];
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === 'tool' && m.toolCalls?.[0]?.name === toolName && !m.toolCalls[0].result) {
        msgs[i] = { ...m, content: m.content + text };
        break;
      }
    }
    return { messages: msgs };
  }),

  // --- Spec ---

  setSpecContent: (md) => set({ specContent: md }),

  setSpecStatus: (status) => set({ specStatus: status }),

  updateTaskSpec: (taskId, specContent) => set((s) => ({
    tasks: s.tasks.map((t) => t.id === taskId ? { ...t, specContent } : t),
  })),

  // --- Artifacts ---

  setActiveArtifactTab: (tab) => set({ activeArtifactTab: tab }),
  setPreviewUrl: (url) => set({ previewUrl: url }),

  // --- Ask user / confirmation ---

  setAskUserRequest: (req) => set({ askUserRequest: req }),
  setConfirmRequest: (req) => set({ confirmRequest: req }),

  // --- Running tasks ---

  addRunningTask: (taskId) => set((s) => ({
    runningTaskIds: s.runningTaskIds.includes(taskId) ? s.runningTaskIds : [...s.runningTaskIds, taskId],
  })),

  removeRunningTask: (taskId) => set((s) => ({
    runningTaskIds: s.runningTaskIds.filter((id) => id !== taskId),
  })),

  // --- Run epoch ---

  setActiveRunId: (runId) => set({ activeRunId: runId }),

  // --- Context / compaction ---

  cumulativeTokens: 0,
  maxContextTokens: 128000,
  isCompacting: false,
  autoCompactEnabled: true,
  autoCompactThreshold: 70,

  updateCumulativeTokens: () => {
    const { messages } = get();
    set({ cumulativeTokens: estimateConversationTokens(messages as any) });
  },

  setMaxContextTokens: (n) => set({ maxContextTokens: n }),
  setAutoCompactEnabled: (enabled) => set({ autoCompactEnabled: enabled }),
  setAutoCompactThreshold: (percent) => set({ autoCompactThreshold: percent }),

  /**
   * Auto-compact: silently check if compaction is needed and trigger it.
   * Called from useQuestEvents after each agent response finishes (done event).
   */
  autoCompactIfNeeded: async () => {
    const { messages, isStreaming, isCompacting, autoCompactEnabled, autoCompactThreshold, cumulativeTokens, maxContextTokens } = get();
    if (!autoCompactEnabled || isStreaming || isCompacting) return;
    if (messages.length < 4 || cumulativeTokens < 2000) return;
    // Cap context window to prevent unreachable thresholds with large-context models
    const effectiveMaxCtx = Math.min(maxContextTokens, 200000);
    const thresholdTokens = Math.floor(effectiveMaxCtx * (autoCompactThreshold / 100));
    if (cumulativeTokens < thresholdTokens) return;
    console.log(`[Quest] Auto-compact triggered: ${cumulativeTokens} tokens >= ${thresholdTokens} threshold`);
    await get().compactQuest();
  },

  compactQuest: async () => {
    const { messages, activeTaskId } = get();
    if (messages.length < 4) return;

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

      // Check task hasn't changed during compaction
      if (get().activeTaskId !== activeTaskId) return;

      if (result.error) {
        console.error('Compact quest failed:', result.error);
        return;
      }

      // Build compressed messages: summary + working window
      const summaryMsg: QuestMessage = {
        id: generateQuestMessageId(),
        role: 'assistant',
        content: `**[Conversation Summary]**\n\n${result.summary}`,
        timestamp: Date.now(),
      };

      set({
        messages: [summaryMsg, ...workingMessages],
        cumulativeTokens: result.estimatedTokens,
      });
    } catch (err) {
      console.error('Compact quest error:', err);
    } finally {
      set({ isCompacting: false });
    }
  }
}));
