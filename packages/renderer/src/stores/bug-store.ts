import { create } from 'zustand';

interface BugState {
  bugs: any[];
  knownBugs: any[];
  loading: boolean;
  analyze: () => Promise<void>;
  fix: (bugId: string) => Promise<void>;
  verify: (bugId: string) => Promise<void>;
}

export const useBugStore = create<BugState>((set, get) => ({
  bugs: [],
  knownBugs: [],
  loading: false,

  analyze: async () => {
    set({ loading: true });
    try {
      const result = await window.electron.ipcRenderer.invoke('bug:analyze');
      set({ bugs: result.bugs ?? [], knownBugs: result.knownBugs ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fix: async (bugId) => {
    set({ loading: true });
    try {
      await window.electron.ipcRenderer.invoke('bug:fix', { bugId });
      await get().analyze();
    } catch {
      set({ loading: false });
    }
  },

  verify: async (bugId) => {
    try {
      await window.electron.ipcRenderer.invoke('bug:verify', { bugId });
    } catch {}
  },
}));