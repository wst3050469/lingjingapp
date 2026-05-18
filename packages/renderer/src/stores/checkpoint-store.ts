import { create } from 'zustand';
import type { Checkpoint, RollbackResult } from '@codepilot/core/checkpoint';

interface CheckpointState {
  checkpoints: Checkpoint[];
  selectedId: string | null;
  isRollingBack: boolean;
  lastRollbackResult: RollbackResult | null;
  loadCheckpoints: () => Promise<void>;
  selectCheckpoint: (id: string) => void;
  rollback: (id: string, strategy?: 'force' | 'preserve-manual-edits') => Promise<void>;
  deleteCheckpoint: (id: string) => Promise<void>;
}

export const useCheckpointStore = create<CheckpointState>((set, get) => ({
  checkpoints: [],
  selectedId: null,
  isRollingBack: false,
  lastRollbackResult: null,

  loadCheckpoints: async () => {
    const result = await window.electronAPI?.checkpoint?.list();
    set({ checkpoints: result ?? [] });
  },

  selectCheckpoint: (id: string) => set({ selectedId: id }),

  rollback: async (id: string, strategy?: 'force' | 'preserve-manual-edits') => {
    set({ isRollingBack: true });
    const result = await window.electronAPI?.checkpoint?.rollback(id, strategy);
    set({ isRollingBack: false, lastRollbackResult: result });
    await get().loadCheckpoints();
  },

  deleteCheckpoint: async (id: string) => {
    await window.electronAPI?.checkpoint?.delete(id);
    await get().loadCheckpoints();
  },
}));
