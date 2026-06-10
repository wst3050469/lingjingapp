import { create } from 'zustand';

interface ReviewState {
  currentReport: any | null;
  reportHistory: any[];
  customRules: any[];
  loading: boolean;
  executeReview: (projectPath: string, diff: string, filePath: string, lang: string, prId?: string, branch?: string, sha?: string) => Promise<void>;
  getReport: (projectPath: string, reportId: string) => Promise<void>;
  listReports: (projectPath: string, filter?: any) => Promise<void>;
  applyFix: (projectPath: string, reportId: string, idx: number) => Promise<void>;
  loadRules: (projectPath: string) => Promise<void>;
  saveRule: (projectPath: string, rule: any) => Promise<void>;
  deleteRule: (projectPath: string, ruleId: string) => Promise<void>;
}

export const useReviewStore = create<ReviewState>((set) => ({
  currentReport: null,
  reportHistory: [],
  customRules: [],
  loading: false,

  executeReview: async (projectPath, diff, filePath, lang, prId, branch, sha) => {
    set({ loading: true });
    try {
      const report = await window.electron.ipcRenderer.invoke('review:execute', projectPath, diff, filePath, lang, prId, branch, sha);
      set({ currentReport: report, loading: false });
    } catch (err) {
      set({ loading: false });
      console.error('[ReviewStore] executeReview error:', err);
    }
  },

  getReport: async (projectPath, reportId) => {
    const report = await window.electron.ipcRenderer.invoke('review:getReport', projectPath, reportId);
    set({ currentReport: report });
  },

  listReports: async (projectPath, filter) => {
    const reports = await window.electron.ipcRenderer.invoke('review:listReports', projectPath, filter);
    set({ reportHistory: reports });
  },

  applyFix: async (projectPath, reportId, idx) => {
    await window.electron.ipcRenderer.invoke('review:applyFix', projectPath, reportId, idx);
  },

  loadRules: async (projectPath) => {
    const rules = await window.electron.ipcRenderer.invoke('review:listRules', projectPath);
    set({ customRules: rules });
  },

  saveRule: async (projectPath, rule) => {
    await window.electron.ipcRenderer.invoke('review:saveRule', projectPath, rule);
  },

  deleteRule: async (projectPath, ruleId) => {
    await window.electron.ipcRenderer.invoke('review:deleteRule', projectPath, ruleId);
  },
}));
