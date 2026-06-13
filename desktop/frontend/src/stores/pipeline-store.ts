import { create } from 'zustand';

interface PipelineState {
  pipelines: any[];
  currentRun: any | null;
  logs: string[];
  runHistory: any[];
  loading: boolean;
  loadPipelines: (projectPath: string) => Promise<void>;
  savePipeline: (projectPath: string, definition: any) => Promise<void>;
  deletePipeline: (projectPath: string, id: string) => Promise<void>;
  triggerPipeline: (projectPath: string, pipelineId: string) => Promise<void>;
  cancelPipeline: (projectPath: string, runId: string) => Promise<void>;
  loadRunHistory: (projectPath: string, pipelineId: string) => Promise<void>;
  appendLog: (log: string) => void;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  pipelines: [],
  currentRun: null,
  logs: [],
  runHistory: [],
  loading: false,

  loadPipelines: async (projectPath: string) => {
    set({ loading: true });
    try {
      const result = await window.electronAPI.invoke('pipeline:list', projectPath);
      set({ pipelines: result, loading: false });
    } catch (err) {
      set({ loading: false });
      console.error('[PipelineStore] loadPipelines error:', err);
    }
  },

  savePipeline: async (projectPath: string, definition: any) => {
    await window.electronAPI.invoke('pipeline:save', projectPath, definition);
    await get().loadPipelines(projectPath);
  },

  deletePipeline: async (projectPath: string, id: string) => {
    await window.electronAPI.invoke('pipeline:delete', projectPath, id);
    await get().loadPipelines(projectPath);
  },

  triggerPipeline: async (projectPath: string, pipelineId: string) => {
    set({ logs: [], loading: true });
    try {
      const run = await window.electronAPI.invoke('pipeline:trigger', projectPath, pipelineId, 'manual');
      set({ currentRun: run, loading: false });
    } catch (err) {
      set({ loading: false });
      console.error('[PipelineStore] triggerPipeline error:', err);
    }
  },

  cancelPipeline: async (projectPath: string, runId: string) => {
    await window.electronAPI.invoke('pipeline:cancel', projectPath, runId);
    set({ currentRun: null });
  },

  loadRunHistory: async (projectPath: string, pipelineId: string) => {
    const result = await window.electronAPI.invoke('pipeline:runHistory', projectPath, pipelineId);
    set({ runHistory: result });
  },

  appendLog: (log: string) => {
    set(state => ({ logs: [...state.logs, log] }));
  },
}));
