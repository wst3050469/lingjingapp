import { create } from 'zustand';

interface MarketplaceState {
  skills: any[];
  searchResults: any[];
  selectedSkill: any | null;
  loading: boolean;
  search: (keyword: string) => Promise<void>;
  install: (skillId: string, version?: string) => Promise<void>;
  uninstall: (skillId: string) => Promise<void>;
  rate: (skillId: string, rating: number) => Promise<void>;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  skills: [],
  searchResults: [],
  selectedSkill: null,
  loading: false,

  search: async (keyword) => {
    set({ loading: true });
    try {
      const results = await window.electron.ipcRenderer.invoke('marketplace:search', { keyword });
      set({ searchResults: results ?? [], loading: false });
    } catch {
      set({ loading: false });
    }
  },

  install: async (skillId, version) => {
    set({ loading: true });
    try {
      const result = await window.electron.ipcRenderer.invoke('marketplace:install', { skillId, version });
      if (!result.success) {
        console.error('Install failed:', result.error);
      }
      set({ loading: false });
    } catch {
      set({ loading: false });
    }
  },

  uninstall: async (skillId) => {
    try {
      await window.electron.ipcRenderer.invoke('marketplace:uninstall', { skillId });
    } catch {}
  },

  rate: async (skillId, rating) => {
    try {
      await window.electron.ipcRenderer.invoke('marketplace:rate', { skillId, rating });
    } catch {}
  },
}));