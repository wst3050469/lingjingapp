// Global indexing progress store
// Persists across component unmounts so indexing progress is visible
// from any page (StatusBar, IndexingTab, etc.)

import { create } from 'zustand';

export interface IndexProgress {
  phase: 'scanning' | 'chunking' | 'embedding' | 'storing' | 'done' | 'error';
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  processedChunks: number;
  message: string;
  fileError?: string;
}

interface IndexingState {
  /** Current live progress (null = no indexing running) */
  currentProgress: IndexProgress | null;
  /** Whether indexing is actively running */
  isIndexing: boolean;
  /** Set progress from IPC event */
  setProgress: (progress: IndexProgress) => void;
  /** Clear progress (indexing done/error) */
  clearProgress: () => void;
}

export const useIndexingStore = create<IndexingState>((set) => ({
  currentProgress: null,
  isIndexing: false,

  setProgress: (progress: IndexProgress) => {
    const isActive = progress.phase !== 'done' && progress.phase !== 'error';
    set({
      currentProgress: progress,
      isIndexing: isActive,
    });
  },

  clearProgress: () => {
    set({ currentProgress: null, isIndexing: false });
  },
}));

/**
 * Initialize global indexing progress listener.
 * This must be called once when the app starts (e.g., in App.tsx).
 * Unlike the IndexingTab's local useEffect, this persists across page navigations.
 */
let initialized = false;

export function initIndexingProgressListener(): () => void {
  if (initialized) {
    return () => {}; // Already initialized
  }
  initialized = true;

  const cleanup = window.electronAPI.indexing.onProgress((progress: IndexProgress) => {
    useIndexingStore.getState().setProgress(progress);
  });

  return () => {
    initialized = false;
    cleanup();
  };
}
