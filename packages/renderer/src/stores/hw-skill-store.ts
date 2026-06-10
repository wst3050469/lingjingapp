import { create } from 'zustand';

interface HwSkillState {
  skills: any[];
  loading: boolean;
  register: (skill: any) => Promise<void>;
  unregister: (skillId: string) => Promise<void>;
  list: () => Promise<void>;
  execute: (skillId: string, toolName: string, params: Record<string, unknown>) => Promise<any>;
  install: (skillDir: string) => Promise<void>;
  uninstall: (skillId: string) => Promise<void>;
  detectCli: (command: string, versionRange: string) => Promise<any>;
}

export const useHwSkillStore = create<HwSkillState>((set, get) => ({
  skills: [],
  loading: false,

  register: async (skill) => {
    try {
      await window.electron.ipcRenderer.invoke('hw-skill:register', { skill });
      await get().list();
    } catch {}
  },

  unregister: async (skillId) => {
    try {
      await window.electron.ipcRenderer.invoke('hw-skill:unregister', { skillId });
      await get().list();
    } catch {}
  },

  list: async () => {
    set({ loading: true });
    try {
      const skills = await window.electron.ipcRenderer.invoke('hw-skill:list');
      set({ skills: skills ?? [], loading: false });
    } catch { set({ loading: false }); }
  },

  execute: async (skillId, toolName, params) => {
    try {
      return await window.electron.ipcRenderer.invoke('hw-skill:execute', { skillId, toolName, params });
    } catch { return { success: false }; }
  },

  install: async (skillDir) => {
    set({ loading: true });
    try {
      await window.electron.ipcRenderer.invoke('hw-skill:install', { skillDir });
      await get().list();
    } catch { set({ loading: false }); }
  },

  uninstall: async (skillId) => {
    try {
      await window.electron.ipcRenderer.invoke('hw-skill:uninstall', { skillId });
      await get().list();
    } catch {}
  },

  detectCli: async (command, versionRange) => {
    try {
      return await window.electron.ipcRenderer.invoke('hw-skill:detect-cli', { command, versionRange });
    } catch { return { available: false }; }
  },
}));