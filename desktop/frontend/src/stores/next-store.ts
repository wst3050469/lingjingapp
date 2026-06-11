// NEXT (inline code prediction) state management

import { create } from 'zustand';

export interface PendingEdit {
  filePath: string;
  startLine: number;
  endLine: number;
  newText: string;
  description?: string;
}

export interface RecentChange {
  filePath: string;
  oldText: string;
  newText: string;
  timestamp: number;
}

interface NextState {
  // Settings
  enabled: boolean;
  triggerInComments: boolean;
  autoImport: boolean;
  disabledExtensions: string[];
  debounceMs: number;

  // Runtime state
  isGenerating: boolean;
  lastAcceptedEdit: { filePath: string; line: number; text: string } | null;

  // Cross-file edit queue
  pendingEdits: PendingEdit[];

  // Recent changes tracking (for context-aware predictions)
  recentChanges: RecentChange[];

  // Actions - Settings
  setEnabled: (v: boolean) => void;
  setTriggerInComments: (v: boolean) => void;
  setAutoImport: (v: boolean) => void;
  setDisabledExtensions: (exts: string[]) => void;
  setDebounceMs: (ms: number) => void;

  // Actions - Runtime
  setGenerating: (v: boolean) => void;
  setLastAcceptedEdit: (edit: NextState['lastAcceptedEdit']) => void;

  // Actions - Recent changes
  addRecentChange: (change: RecentChange) => void;
  clearRecentChanges: () => void;

  // Actions - Pending edits
  addPendingEdit: (edit: PendingEdit) => void;
  addPendingEdits: (edits: PendingEdit[]) => void;
  consumeNextPendingEdit: () => PendingEdit | undefined;
  clearPendingEdits: () => void;

  // Sync from config
  syncFromConfig: (nextConfig: Record<string, any>) => void;
}

const MAX_RECENT_CHANGES = 20;

export const useNextStore = create<NextState>((set, get) => ({
  // Default settings
  enabled: true,
  triggerInComments: true,
  autoImport: true,
  disabledExtensions: [],
  debounceMs: 500,

  // Runtime
  isGenerating: false,
  lastAcceptedEdit: null,

  // Queues
  pendingEdits: [],
  recentChanges: [],

  // Settings actions
  setEnabled: (v) => set({ enabled: v }),
  setTriggerInComments: (v) => set({ triggerInComments: v }),
  setAutoImport: (v) => set({ autoImport: v }),
  setDisabledExtensions: (exts) => set({ disabledExtensions: exts }),
  setDebounceMs: (ms) => set({ debounceMs: ms }),

  // Runtime actions
  setGenerating: (v) => set({ isGenerating: v }),
  setLastAcceptedEdit: (edit) => set({ lastAcceptedEdit: edit }),

  // Recent changes
  addRecentChange: (change) => set((state) => {
    const updated = [...state.recentChanges, change];
    // Keep only the most recent N changes
    if (updated.length > MAX_RECENT_CHANGES) {
      return { recentChanges: updated.slice(-MAX_RECENT_CHANGES) };
    }
    return { recentChanges: updated };
  }),
  clearRecentChanges: () => set({ recentChanges: [] }),

  // Pending edits
  addPendingEdit: (edit) => set((state) => ({
    pendingEdits: [...state.pendingEdits, edit],
  })),
  addPendingEdits: (edits) => set((state) => ({
    pendingEdits: [...state.pendingEdits, ...edits],
  })),
  consumeNextPendingEdit: () => {
    const state = get();
    if (state.pendingEdits.length === 0) return undefined;
    const [next, ...rest] = state.pendingEdits;
    set({ pendingEdits: rest });
    return next;
  },
  clearPendingEdits: () => set({ pendingEdits: [] }),

  // Sync settings from loaded config
  syncFromConfig: (nextConfig) => {
    if (!nextConfig) return;
    set({
      enabled: nextConfig.enabled ?? true,
      triggerInComments: nextConfig.triggerInComments ?? true,
      autoImport: nextConfig.autoImport ?? true,
      disabledExtensions: nextConfig.disabledExtensions ?? [],
      debounceMs: nextConfig.debounceMs ?? 500,
    });
  },
}));
