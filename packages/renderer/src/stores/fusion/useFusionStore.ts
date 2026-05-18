import { create } from 'zustand';

interface ModuleState {
  enabled: boolean;
  healthy: boolean;
}

interface FusionState {
  modules: Record<string, ModuleState>;
  loading: boolean;
  error: string | null;
  fetchHealth: () => Promise<void>;
  toggleModule: (moduleName: string, enabled: boolean) => Promise<void>;
}

async function ipcInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  if (!window.electronAPI?.invoke) {
    throw new Error('electronAPI not available');
  }
  return window.electronAPI.invoke(channel, ...args);
}

export const useFusionStore = create<FusionState>((set) => ({
  modules: {},
  loading: false,
  error: null,

  fetchHealth: async () => {
    set({ loading: true, error: null });
    try {
      const health = await ipcInvoke('fusion:health:check') as Record<string, { healthy: boolean; enabled: boolean }>;
      const modules: Record<string, ModuleState> = {};
      for (const [name, state] of Object.entries(health)) {
        modules[name] = { enabled: state.enabled, healthy: state.healthy };
      }
      set({ modules, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  toggleModule: async (moduleName: string, enabled: boolean) => {
    try {
      await ipcInvoke('fusion:module:toggle', moduleName, enabled);
      set((state) => ({
        modules: {
          ...state.modules,
          [moduleName]: { ...state.modules[moduleName], enabled },
        },
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
