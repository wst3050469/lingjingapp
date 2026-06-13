import { create } from 'zustand';

interface SecurityState {
  currentResult: any | null;
  scanHistory: any[];
  customRules: any[];
  loading: boolean;
  progress: { phase: string; current: number; total: number; filePath?: string } | null;
  scan: (projectPath: string, scope?: string, files?: string[]) => Promise<void>;
  cancelScan: (projectPath: string) => void;
  getResult: (projectPath: string, scanId: string) => Promise<void>;
  listResults: (projectPath: string) => Promise<void>;
  applyFix: (projectPath: string, vulnerability: any) => Promise<void>;
  loadRules: (projectPath: string) => Promise<void>;
  saveRule: (projectPath: string, rule: any) => Promise<void>;
  deleteRule: (projectPath: string, ruleId: string) => Promise<void>;
  compareResults: (projectPath: string, scanId1: string, scanId2: string) => Promise<any>;
}

export const useSecurityStore = create<SecurityState>((set) => ({
  currentResult: null,
  scanHistory: [],
  customRules: [],
  loading: false,
  progress: null,

  scan: async (projectPath, scope, files) => {
    set({ loading: true, progress: { phase: 'starting', current: 0, total: 0 } });
    try {
      const result = await window.electronAPI.invoke('security:scan', projectPath, scope || 'full', files);
      set({ currentResult: result, loading: false, progress: null });
    } catch (err) {
      set({ loading: false, progress: null });
      console.error('[SecurityStore] scan error:', err);
    }
  },

  cancelScan: (projectPath) => {
    window.electronAPI.invoke('security:cancel', projectPath);
    set({ loading: false, progress: null });
  },

  getResult: async (projectPath, scanId) => {
    const result = await window.electronAPI.invoke('security:getResult', projectPath, scanId);
    set({ currentResult: result });
  },

  listResults: async (projectPath) => {
    const results = await window.electronAPI.invoke('security:listResults', projectPath);
    set({ scanHistory: results });
  },

  applyFix: async (projectPath, vulnerability) => {
    await window.electronAPI.invoke('security:applyFix', projectPath, vulnerability);
  },

  loadRules: async (projectPath) => {
    const rules = await window.electronAPI.invoke('security:listRules', projectPath);
    set({ customRules: rules });
  },

  saveRule: async (projectPath, rule) => {
    await window.electronAPI.invoke('security:saveRule', projectPath, rule);
  },

  deleteRule: async (projectPath, ruleId) => {
    await window.electronAPI.invoke('security:deleteRule', projectPath, ruleId);
  },

  compareResults: async (projectPath, scanId1, scanId2) => {
    return window.electronAPI.invoke('security:compareResults', projectPath, scanId1, scanId2);
  },
}));
