import { create } from 'zustand';

export interface ConversationSnapshot {
  id: string;
  conversationId: string;
  label: string;
  messageCount: number;
  timestamp: number;
}

interface SnapshotState {
  snapshots: ConversationSnapshot[];
  addSnapshot: (snapshot: ConversationSnapshot) => void;
  removeSnapshot: (id: string) => void;
  clearSnapshots: () => void;
}

/**
 * Stub: Conversation snapshot manager.
 * Will allow saving/restoring conversation states in a future iteration.
 */
export const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: [],
  addSnapshot: (snapshot) =>
    set((state) => ({ snapshots: [...state.snapshots, snapshot] })),
  removeSnapshot: (id) =>
    set((state) => ({ snapshots: state.snapshots.filter((s) => s.id !== id) })),
  clearSnapshots: () => set({ snapshots: [] }),
}));

/** Generate a snapshot ID */
export function generateSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
