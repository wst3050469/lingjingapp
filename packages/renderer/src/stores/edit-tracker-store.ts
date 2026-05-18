import { create } from 'zustand';

export type FileEditStatus = 'generating' | 'applying' | 'applied' | 'error';

export interface TrackedEdit {
  filePath: string;
  status: FileEditStatus;
  toolName: string;
}

interface EditTrackerState {
  trackedEdits: TrackedEdit[];
  addEdit: (filePath: string, toolName: string) => void;
  updateEditStatus: (filePath: string, status: FileEditStatus) => void;
  clearEdits: () => void;
}

export const useEditTrackerStore = create<EditTrackerState>((set) => ({
  trackedEdits: [],

  addEdit: (filePath, toolName) => set((state) => {
    // Avoid duplicates for same file
    const existing = state.trackedEdits.find((e) => e.filePath === filePath);
    if (existing) {
      return {
        trackedEdits: state.trackedEdits.map((e) =>
          e.filePath === filePath ? { ...e, status: 'generating' as const, toolName } : e
        ),
      };
    }
    return { trackedEdits: [...state.trackedEdits, { filePath, toolName, status: 'generating' }] };
  }),

  updateEditStatus: (filePath, status) => set((state) => ({
    trackedEdits: state.trackedEdits.map((e) =>
      e.filePath === filePath ? { ...e, status } : e
    ),
  })),

  clearEdits: () => set({ trackedEdits: [] }),
}));
