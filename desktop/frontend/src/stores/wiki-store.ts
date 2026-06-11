// Wiki panel Zustand store

import { create } from 'zustand';
import type { WikiStatus, WikiTocEntry, WikiChangeDetection } from '../ipc/ipc-client';

interface WikiState {
  // Data
  status: WikiStatus | null;
  toc: WikiTocEntry[];
  hasOverview: boolean;
  selectedModule: string | null;
  content: string;

  // Progress
  isGenerating: boolean;
  isUpdating: boolean;
  progress: { phase: string; current: number; total: number; modulePath?: string } | null;
  error: string | null;

  // Change detection
  changedModules: string[];

  // Prerequisite checks
  workspaceMissing: boolean;
  modelMissing: boolean;
  checkingPrerequisites: boolean;

  // Actions
  loadStatus: () => Promise<void>;
  loadToc: () => Promise<void>;
  selectModule: (path: string) => Promise<void>;
  generate: () => Promise<void>;
  detectChanges: () => Promise<void>;
  update: (modules?: string[]) => Promise<void>;
  abort: () => void;
  clearError: () => void;

  // Called by event hook
  onProgress: (event: { phase: string; current: number; total: number; modulePath?: string }) => void;
  onError: (message: string) => void;
  onDone: () => void;

  // Prerequisite checks
  checkPrerequisites: () => Promise<void>;
}

export const useWikiStore = create<WikiState>((set, get) => ({
  status: null,
  toc: [],
  hasOverview: false,
  selectedModule: null,
  content: '',
  isGenerating: false,
  isUpdating: false,
  progress: null,
  error: null,
  changedModules: [],
  workspaceMissing: false,
  modelMissing: false,
  checkingPrerequisites: false,

  checkPrerequisites: async () => {
    set({ checkingPrerequisites: true, workspaceMissing: false, modelMissing: false });
    try {
      // Check workspace
      const workspace = await window.electronAPI.config.getWorkspace();
      if (!workspace) {
        set({ workspaceMissing: true, checkingPrerequisites: false });
        return;
      }

      // Check if model is configured
      const config = await window.electronAPI.config.get();
      const hasModel = !!(config?.model || (config as any)?.currentModel);
      // Also check for provider API keys
      const hasApiKey = config?.apiKeys && Object.keys(config.apiKeys as Record<string, string>).length > 0;

      set({
        modelMissing: !hasModel,
        checkingPrerequisites: false,
      });
    } catch {
      set({ checkingPrerequisites: false });
    }
  },

  loadStatus: async () => {
    try {
      const status = await window.electronAPI.wiki.status();
      set({
        status,
        workspaceMissing: (status as any)?.workspaceMissing === true,
      });
      // Check model prerequisite
      if (!(status as any)?.workspaceMissing) {
        get().checkPrerequisites();
      }
    } catch {
      // ignore
    }
  },

  loadToc: async () => {
    try {
      const result = await window.electronAPI.wiki.loadToc();
      set({ toc: result.modules, hasOverview: result.hasOverview });
    } catch {
      // ignore
    }
  },

  selectModule: async (path: string) => {
    set({ selectedModule: path, content: '' });
    try {
      const result = await window.electronAPI.wiki.loadContent(path);
      set({ content: result.content });
    } catch {
      set({ content: '' });
    }
  },

  generate: async () => {
    set({ isGenerating: true, progress: null, error: null });
    try {
      await window.electronAPI.wiki.generate();
      set({ isGenerating: false });
    } catch (err) {
      set({ isGenerating: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  detectChanges: async () => {
    try {
      const result = await window.electronAPI.wiki.detectChanges();
      set({ changedModules: result.changedModules });
      // Auto-trigger update if changes found and not already updating
      if (result.changedModules.length > 0 && !get().isUpdating && !get().isGenerating) {
        get().update(result.changedModules);
      }
    } catch {
      // ignore
    }
  },

  update: async (modules?: string[]) => {
    set({ isUpdating: true, progress: null, error: null });
    try {
      await window.electronAPI.wiki.update(modules ? { modules } : undefined);
      set({ isUpdating: false });
    } catch (err) {
      set({ isUpdating: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  abort: () => {
    window.electronAPI.wiki.abort().catch((err) => { console.warn('[WikiStore] abort failed:', err); });
    set({ isGenerating: false, isUpdating: false, progress: null });
  },

  clearError: () => set({ error: null }),

  onProgress: (event) => {
    set({ progress: event });
  },

  onError: (message) => {
    set({ isGenerating: false, isUpdating: false, error: message, progress: null });
  },

  onDone: () => {
    set({ isGenerating: false, isUpdating: false, progress: null });
    // Reload status and toc after generation/update completes
    get().loadStatus();
    get().loadToc();
    // Re-select current module to refresh content
    const selected = get().selectedModule;
    if (selected) {
      get().selectModule(selected);
    }
  },
}));
