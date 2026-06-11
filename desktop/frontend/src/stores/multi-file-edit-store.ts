import { create } from 'zustand';
import type { MultiFileEditSession, FileDiff, ApplyResult } from '@codepilot/core/multi-file-edit';

interface MultiFileEditState {
  session: MultiFileEditSession | null;
  applyResults: ApplyResult[];

  setSession: (session: MultiFileEditSession) => void;
  acceptFile: (filePath: string) => void;
  rejectFile: (filePath: string) => void;
  setApplyResults: (results: ApplyResult[]) => void;
  reset: () => void;
}

export const useMultiFileEditStore = create<MultiFileEditState>((set, get) => ({
  session: null,
  applyResults: [],

  setSession: (session) => set({ session }),
  acceptFile: (filePath) => {
    const session = get().session;
    if (!session) return;
    set({
      session: {
        ...session,
        files: session.files.map(f =>
          f.filePath === filePath
            ? { ...f, hunks: f.hunks.map(h => ({ ...h, decision: 'accepted' as const })) }
            : f
        ),
      },
    });
  },
  rejectFile: (filePath) => {
    const session = get().session;
    if (!session) return;
    set({
      session: {
        ...session,
        files: session.files.map(f =>
          f.filePath === filePath
            ? { ...f, hunks: f.hunks.map(h => ({ ...h, decision: 'rejected' as const })) }
            : f
        ),
      },
    });
  },
  setApplyResults: (results) => set({ applyResults: results }),
  reset: () => set({ session: null, applyResults: [] }),
}));
