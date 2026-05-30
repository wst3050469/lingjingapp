import { create } from 'zustand';

export interface QuestDiffLine {
  lineNumber: number;
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export interface QuestDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: QuestDiffLine[];
}

export interface QuestFileChange {
  filePath: string;
  fileName: string;
  beforeContent: string | null;
  afterContent: string;
  isNewFile: boolean;
  status: 'pending' | 'accepted' | 'rejected';
  addedLines?: number;
  removedLines?: number;
}

interface QuestDiffState {
  fileChanges: Record<string, QuestFileChange>;
  activeReviewFile: string | null;

  setFileChanges: (changes: Record<string, QuestFileChange>) => void;
  setActiveReviewFile: (filePath: string | null) => void;
  updateFileStatus: (filePath: string, status: QuestFileChange['status']) => void;
  acceptFile: (filePath: string) => void;
  rejectFile: (filePath: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  clearChanges: () => void;
  clearReview: () => void;
  addFileChange: (filePath: string, beforeContent: string | null, afterContent: string, toolName: string, isNewFile?: boolean) => void;
}

/** Fire-and-forget revert a file on disk via IPC. Logs errors silently. */
function revertFileOnDisk(filePath: string, beforeContent: string | null): void {
  try {
    window.electronAPI.quest.revertFile(filePath, beforeContent).catch((err: unknown) => {
      console.warn('[QuestDiff] revert file failed:', filePath, err);
    });
  } catch {
    // window.electronAPI not available during SSR/testing
  }
}

export const useQuestDiffStore = create<QuestDiffState>((set) => ({
  fileChanges: {},
  activeReviewFile: null,

  setFileChanges: (changes) => set({ fileChanges: changes }),
  setActiveReviewFile: (filePath) => set({ activeReviewFile: filePath }),

  updateFileStatus: (filePath, status) =>
    set((state) => {
      const file = state.fileChanges[filePath];
      if (!file) return state;
      return { fileChanges: { ...state.fileChanges, [filePath]: { ...file, status } } };
    }),

  acceptFile: (filePath) =>
    set((state) => {
      const file = state.fileChanges[filePath];
      if (!file) return state;
      return { fileChanges: { ...state.fileChanges, [filePath]: { ...file, status: 'accepted' as const } } };
    }),

  rejectFile: (filePath) => {
    const state = useQuestDiffStore.getState();
    const file = state.fileChanges[filePath];
    if (file) {
      // Revert on disk before updating UI
      revertFileOnDisk(file.filePath, file.beforeContent);
    }
    set((state) => {
      const file = state.fileChanges[filePath];
      if (!file) return state;
      return { fileChanges: { ...state.fileChanges, [filePath]: { ...file, status: 'rejected' as const } } };
    });
  },

  acceptAll: () =>
    set((state) => {
      const changes: Record<string, QuestFileChange> = {};
      for (const [k, v] of Object.entries(state.fileChanges)) {
        changes[k] = { ...v, status: 'accepted' };
      }
      return { fileChanges: changes };
    }),

  rejectAll: () => {
    // Revert all pending files on disk before updating UI
    const state = useQuestDiffStore.getState();
    for (const [, file] of Object.entries(state.fileChanges)) {
      if (file.status === 'pending') {
        revertFileOnDisk(file.filePath, file.beforeContent);
      }
    }
    set((state) => {
      const changes: Record<string, QuestFileChange> = {};
      for (const [k, v] of Object.entries(state.fileChanges)) {
        changes[k] = { ...v, status: 'rejected' };
      }
      return { fileChanges: changes };
    });
  },

  clearChanges: () => set({ fileChanges: {}, activeReviewFile: null }),
  clearReview: () => set({ fileChanges: {}, activeReviewFile: null }),

  addFileChange: (filePath, beforeContent, afterContent, _toolName, isNewFile) => {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    set((state) => ({
      fileChanges: {
        ...state.fileChanges,
        [filePath]: {
          filePath,
          fileName,
          beforeContent,
          afterContent,
          isNewFile: isNewFile ?? (beforeContent === null),
          status: 'pending',
        },
      },
    }));
  },
}));
