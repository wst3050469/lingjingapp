import { create } from 'zustand';

interface HwAiState {
  results: any[];
  loading: boolean;
  generateSchematic: (description: string, sessionId: string) => Promise<any>;
  suggestPcbLayout: (schematicContent: string, sessionId: string) => Promise<any>;
  suggestDrcFix: (violations: string, sessionId: string) => Promise<any>;
  selectComponent: (requirements: string, sessionId: string) => Promise<any>;
  applyResult: (resultId: string) => Promise<boolean>;
  rollbackResult: (resultId: string) => Promise<boolean>;
}

export const useHwAiStore = create<HwAiState>((set) => ({
  results: [],
  loading: false,

  generateSchematic: async (description, sessionId) => {
    set({ loading: true });
    try {
      const result = await window.electron.ipcRenderer.invoke('hw-ai:generate-schematic', { description, sessionId });
      set((s) => ({ results: [...s.results, result], loading: false }));
      return result;
    } catch { set({ loading: false }); return null; }
  },

  suggestPcbLayout: async (schematicContent, sessionId) => {
    set({ loading: true });
    try {
      const result = await window.electron.ipcRenderer.invoke('hw-ai:suggest-pcb-layout', { schematicContent, sessionId });
      set((s) => ({ results: [...s.results, result], loading: false }));
      return result;
    } catch { set({ loading: false }); return null; }
  },

  suggestDrcFix: async (violations, sessionId) => {
    set({ loading: true });
    try {
      const result = await window.electron.ipcRenderer.invoke('hw-ai:suggest-drc-fix', { violations, sessionId });
      set((s) => ({ results: [...s.results, result], loading: false }));
      return result;
    } catch { set({ loading: false }); return null; }
  },

  selectComponent: async (requirements, sessionId) => {
    set({ loading: true });
    try {
      const result = await window.electron.ipcRenderer.invoke('hw-ai:select-component', { requirements, sessionId });
      set((s) => ({ results: [...s.results, result], loading: false }));
      return result;
    } catch { set({ loading: false }); return null; }
  },

  applyResult: async (resultId) => {
    try {
      return await window.electron.ipcRenderer.invoke('hw-ai:apply-result', { resultId });
    } catch { return false; }
  },

  rollbackResult: async (resultId) => {
    try {
      return await window.electron.ipcRenderer.invoke('hw-ai:rollback-result', { resultId });
    } catch { return false; }
  },
}));