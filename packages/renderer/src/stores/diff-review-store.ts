// Diff Review Store - central state for reviewing AI-generated code changes

import { create } from 'zustand';
import { computeHunks, applyPartialDiff, type DiffHunk } from '../utils/diff-utils';

export interface FileChange {
  filePath: string;
  fileName: string;
  beforeContent: string | null; // null = new file
  afterContent: string;
  hunks: DiffHunk[];
  isNewFile: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'partial';
}

interface DiffReviewState {
  fileChanges: Record<string, FileChange>;
  isReviewActive: boolean;
  activeReviewFile: string | null;

  addFileChange: (
    filePath: string,
    beforeContent: string | null,
    afterContent: string,
    toolName: string,
    isNewFile: boolean
  ) => void;
  activateReview: () => void;
  setActiveReviewFile: (path: string | null) => void;
  acceptHunk: (filePath: string, hunkId: string) => void;
  rejectHunk: (filePath: string, hunkId: string) => void;
  acceptFile: (filePath: string) => void;
  rejectFile: (filePath: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  finalizeReview: () => Promise<void>;
  clearReview: () => void;
}

function deriveFileStatus(hunks: DiffHunk[]): FileChange['status'] {
  if (hunks.length === 0) return 'accepted';
  const decisions = hunks.map((h) => h.decision);
  const allAccepted = decisions.every((d) => d === 'accepted');
  const allRejected = decisions.every((d) => d === 'rejected');
  if (allAccepted) return 'accepted';
  if (allRejected) return 'rejected';
  if (decisions.some((d) => d !== 'pending')) return 'partial';
  return 'pending';
}

function extractFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

export const useDiffReviewStore = create<DiffReviewState>((set, get) => ({
  fileChanges: {},
  isReviewActive: false,
  activeReviewFile: null,

  addFileChange: (filePath, beforeContent, afterContent, _toolName, isNewFile) => set((state) => {
    const existing = state.fileChanges[filePath];
    // If file already tracked, keep original beforeContent but update afterContent
    const before = existing ? existing.beforeContent : beforeContent;
    const hunks = computeHunks(before ?? '', afterContent);

    return {
      fileChanges: {
        ...state.fileChanges,
        [filePath]: {
          filePath,
          fileName: extractFileName(filePath),
          beforeContent: before,
          afterContent,
          hunks,
          isNewFile: existing ? existing.isNewFile : isNewFile,
          status: 'pending',
        },
      },
    };
  }),

  activateReview: () => set((state) => {
    const filePaths = Object.keys(state.fileChanges);
    if (filePaths.length === 0) return {};
    return {
      isReviewActive: true,
      activeReviewFile: filePaths[0],
    };
  }),

  setActiveReviewFile: (path) => set({ activeReviewFile: path }),

  acceptHunk: (filePath, hunkId) => set((state) => {
    const fc = state.fileChanges[filePath];
    if (!fc) return {};
    const hunks = fc.hunks.map((h) => h.id === hunkId ? { ...h, decision: 'accepted' as const } : h);
    return {
      fileChanges: {
        ...state.fileChanges,
        [filePath]: { ...fc, hunks, status: deriveFileStatus(hunks) },
      },
    };
  }),

  rejectHunk: (filePath, hunkId) => set((state) => {
    const fc = state.fileChanges[filePath];
    if (!fc) return {};
    const hunks = fc.hunks.map((h) => h.id === hunkId ? { ...h, decision: 'rejected' as const } : h);
    return {
      fileChanges: {
        ...state.fileChanges,
        [filePath]: { ...fc, hunks, status: deriveFileStatus(hunks) },
      },
    };
  }),

  acceptFile: (filePath) => set((state) => {
    const fc = state.fileChanges[filePath];
    if (!fc) return {};
    const hunks = fc.hunks.map((h) => ({ ...h, decision: 'accepted' as const }));
    return {
      fileChanges: {
        ...state.fileChanges,
        [filePath]: { ...fc, hunks, status: 'accepted' },
      },
    };
  }),

  rejectFile: (filePath) => set((state) => {
    const fc = state.fileChanges[filePath];
    if (!fc) return {};
    const hunks = fc.hunks.map((h) => ({ ...h, decision: 'rejected' as const }));
    return {
      fileChanges: {
        ...state.fileChanges,
        [filePath]: { ...fc, hunks, status: 'rejected' },
      },
    };
  }),

  acceptAll: () => set((state) => {
    const updated: Record<string, FileChange> = {};
    for (const [fp, fc] of Object.entries(state.fileChanges)) {
      const hunks = fc.hunks.map((h) => ({ ...h, decision: 'accepted' as const }));
      updated[fp] = { ...fc, hunks, status: 'accepted' };
    }
    return { fileChanges: updated };
  }),

  rejectAll: () => set((state) => {
    const updated: Record<string, FileChange> = {};
    for (const [fp, fc] of Object.entries(state.fileChanges)) {
      const hunks = fc.hunks.map((h) => ({ ...h, decision: 'rejected' as const }));
      updated[fp] = { ...fc, hunks, status: 'rejected' };
    }
    return { fileChanges: updated };
  }),

  finalizeReview: async () => {
    const { fileChanges } = get();
    const editorStoreModule = await import('./editor-store');
    const { useEditorStore } = editorStoreModule;

    for (const fc of Object.values(fileChanges)) {
      const allAccepted = fc.hunks.every((h) => h.decision === 'accepted' || h.decision === 'pending');
      const allRejected = fc.hunks.every((h) => h.decision === 'rejected');

      if (allAccepted) {
        // No disk write needed — file already has the new content
        // Just reload editor to ensure sync
        useEditorStore.getState().reloadFile(fc.filePath, fc.afterContent);
      } else if (allRejected) {
        if (fc.isNewFile || fc.beforeContent === null) {
          // New file rejected: delete it
          try {
            await window.electronAPI.diffReview.delete(fc.filePath);
          } catch { /* ignore if already deleted */ }
          useEditorStore.getState().closeFile(fc.filePath);
        } else {
          // Revert to original content
          await window.electronAPI.diffReview.revert(fc.filePath, fc.beforeContent);
          useEditorStore.getState().reloadFile(fc.filePath, fc.beforeContent);
        }
      } else {
        // Partial: reconstruct content by applying only accepted hunks
        const resolvedContent = applyPartialDiff(
          fc.beforeContent ?? '',
          fc.afterContent,
          fc.hunks
        );
        await window.electronAPI.diffReview.revert(fc.filePath, resolvedContent);
        useEditorStore.getState().reloadFile(fc.filePath, resolvedContent);
      }
    }

    // Exit review mode
    set({
      fileChanges: {},
      isReviewActive: false,
      activeReviewFile: null,
    });
  },

  clearReview: () => set({
    fileChanges: {},
    isReviewActive: false,
    activeReviewFile: null,
  }),
}));
