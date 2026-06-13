import { create } from 'zustand';

interface PMState {
  workItems: any[];
  boardColumns: any[];
  milestones: any[];
  loading: boolean;
  loadWorkItems: (projectPath: string, filter?: any) => Promise<void>;
  createWorkItem: (projectPath: string, input: any) => Promise<string>;
  updateWorkItem: (projectPath: string, id: string, input: any) => Promise<void>;
  updateStatus: (projectPath: string, id: string, status: string, changedBy?: string, wipLimit?: number, currentCount?: number) => Promise<void>;
  deleteWorkItem: (projectPath: string, id: string) => Promise<void>;
  linkCommit: (projectPath: string, workItemId: string, commitSha: string, message: string) => Promise<void>;
  loadBoard: (projectPath: string) => Promise<void>;
  updateWipLimit: (projectPath: string, columnId: string, wipLimit: number) => Promise<void>;
  loadMilestones: (projectPath: string) => Promise<void>;
  exportData: (projectPath: string, format?: string) => Promise<string>;
}

export const usePMStore = create<PMState>((set, get) => ({
  workItems: [],
  boardColumns: [],
  milestones: [],
  loading: false,

  loadWorkItems: async (projectPath, filter) => {
    set({ loading: true });
    try {
      const items = await window.electronAPI.invoke('pm:listWorkItems', projectPath, filter);
      set({ workItems: items, loading: false });
    } catch (err) {
      set({ loading: false });
      console.error('[PMStore] loadWorkItems error:', err);
    }
  },

  createWorkItem: async (projectPath, input) => {
    const id = await window.electronAPI.invoke('pm:createWorkItem', projectPath, input);
    await get().loadWorkItems(projectPath);
    return id;
  },

  updateWorkItem: async (projectPath, id, input) => {
    await window.electronAPI.invoke('pm:updateWorkItem', projectPath, id, input);
    await get().loadWorkItems(projectPath);
  },

  updateStatus: async (projectPath, id, status, changedBy, wipLimit, currentCount) => {
    await window.electronAPI.invoke('pm:updateStatus', projectPath, id, status, changedBy, wipLimit, currentCount);
    await get().loadWorkItems(projectPath);
  },

  deleteWorkItem: async (projectPath, id) => {
    await window.electronAPI.invoke('pm:deleteWorkItem', projectPath, id);
    await get().loadWorkItems(projectPath);
  },

  linkCommit: async (projectPath, workItemId, commitSha, message) => {
    await window.electronAPI.invoke('pm:linkCommit', projectPath, workItemId, commitSha, message);
  },

  loadBoard: async (projectPath) => {
    set({ loading: true });
    try {
      const board = await window.electronAPI.invoke('pm:getBoard', projectPath);
      set({ boardColumns: board.columns, workItems: board.workItems, loading: false });
    } catch (err) {
      set({ loading: false });
      console.error('[PMStore] loadBoard error:', err);
    }
  },

  updateWipLimit: async (projectPath, columnId, wipLimit) => {
    await window.electronAPI.invoke('pm:updateWipLimit', projectPath, columnId, wipLimit);
  },

  loadMilestones: async (projectPath) => {
    const ms = await window.electronAPI.invoke('pm:listMilestones', projectPath);
    set({ milestones: ms });
  },

  exportData: async (projectPath, format) => {
    return window.electronAPI.invoke('pm:exportData', projectPath, format || 'json');
  },
}));
