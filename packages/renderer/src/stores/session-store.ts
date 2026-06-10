import { create } from 'zustand';

interface SessionState {
  sessions: Array<{
    sessionId: string;
    type: 'chat' | 'quest';
    status: string;
    taskTitle?: string;
    turnCount: number;
    updatedAt: number;
  }>;
  activeSessionId: string | null;
  interruptedSessions: Set<string>;
  loading: boolean;
  checkpointSaving: boolean;

  setActiveSession: (sessionId: string | null) => void;
  checkpoint: (sessionId: string) => Promise<void>;
  restore: (sessionId: string) => Promise<any | null>;
  listActive: () => Promise<string[]>;
  detectInterruption: (sessionId: string) => Promise<{ interrupted: boolean; recovered: boolean }>;
  markInterrupted: (sessionId: string) => void;
  clearInterrupted: (sessionId: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  interruptedSessions: new Set(),
  loading: false,
  checkpointSaving: false,

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  checkpoint: async (sessionId) => {
    set({ checkpointSaving: true });
    try {
      await window.electron.ipcRenderer.invoke('session:checkpoint', { sessionId });
    } catch (err) {
      console.error('session:checkpoint error:', err);
    } finally {
      set({ checkpointSaving: false });
    }
  },

  restore: async (sessionId) => {
    set({ loading: true });
    try {
      const result = await window.electron.ipcRenderer.invoke('session:restore', { sessionId });
      set({ loading: false });
      return result?.data ?? null;
    } catch (err) {
      console.error('session:restore error:', err);
      set({ loading: false });
      return null;
    }
  },

  listActive: async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('session:list-active');
      return result?.sessionIds ?? [];
    } catch (err) {
      console.error('session:list-active error:', err);
      return [];
    }
  },

  detectInterruption: async (sessionId) => {
    try {
      const result = await window.electron.ipcRenderer.invoke('session:detect-interruption', { sessionId });
      if (result?.interrupted) {
        get().markInterrupted(sessionId);
        if (result?.recovered) {
          get().clearInterrupted(sessionId);
        }
      }
      return { interrupted: result?.interrupted ?? false, recovered: result?.recovered ?? false };
    } catch (err) {
      console.error('session:detect-interruption error:', err);
      return { interrupted: false, recovered: false };
    }
  },

  markInterrupted: (sessionId) => {
    set((state) => {
      const next = new Set(state.interruptedSessions);
      next.add(sessionId);
      return { interruptedSessions: next };
    });
  },

  clearInterrupted: (sessionId) => {
    set((state) => {
      const next = new Set(state.interruptedSessions);
      next.delete(sessionId);
      return { interruptedSessions: next };
    });
  },
}));