import { create } from 'zustand';

type WindowMode = 'embedded' | 'standalone' | 'fullscreen';

interface InstallationInfo {
  found: boolean;
  path?: string;
  version?: string;
  compatible: boolean;
}

interface ScriptResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

interface OpenSpaceProfile {
  name: string;
  path: string;
  modules: string[];
  metadata: Record<string, string>;
}

interface DatasetEntry {
  name: string;
  path: string;
  status: 'loaded' | 'unloaded' | 'loading' | 'error';
  type: string;
}

interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  frameCount: number;
}

interface SyncStatus {
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  role: string;
  latency: number;
  clientCount: number;
}

interface OpenSpaceStoreState {
  runState: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  health: { healthy: boolean; state: string } | null;
  installation: InstallationInfo | null;
  bridgeConnected: boolean;
  transport: string | null;
  currentScript: string;
  currentLanguage: 'lua' | 'javascript' | 'python';
  scriptResult: ScriptResult | null;
  scriptTemplates: unknown[];
  profiles: OpenSpaceProfile[];
  activeProfileId: string | null;
  windowMode: WindowMode;
  datasets: DatasetEntry[];
  datasetRoot: string;
  recordingState: 'idle' | 'recording' | 'paused';
  recordingSessions: RecordingSession[];
  currentSessionId: string | null;
  syncStatus: SyncStatus | null;
  degraded: boolean;
  installGuideVisible: boolean;
}

interface OpenSpaceStoreActions {
  detectInstallation: () => Promise<void>;
  setManualPath: (path: string) => Promise<void>;
  startOpenSpace: (config?: Record<string, unknown>) => Promise<void>;
  stopOpenSpace: () => Promise<void>;
  executeScript: (script: string, language?: string, timeout?: number) => Promise<void>;
  generateScript: (prompt: string, language?: string) => Promise<void>;
  getTemplates: () => Promise<void>;

  // Profile
  listProfiles: (dataDir?: string) => Promise<void>;
  getProfile: (name: string) => Promise<void>;
  createProfile: (profile: OpenSpaceProfile) => Promise<void>;
  updateProfile: (profile: OpenSpaceProfile) => Promise<void>;
  deleteProfile: (name: string) => Promise<void>;
  hotReloadProfile: () => Promise<void>;

  // Renderer
  setWindowMode: (mode: WindowMode) => Promise<void>;
  setDisplay: (displayId: number) => Promise<void>;

  // Datasets
  scanDatasets: (dataDir?: string) => Promise<void>;
  searchDatasets: (query: string) => Promise<void>;
  loadDataset: (name: string) => Promise<void>;
  unloadDataset: (name: string) => Promise<void>;

  // Recording
  startRecording: (config?: Record<string, unknown>) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  listRecordingSessions: () => Promise<void>;

  // Sync
  syncConnect: (config: { host: string; port: number; role: string; password?: string }) => Promise<void>;
  syncDisconnect: () => Promise<void>;
  syncGetStatus: () => Promise<void>;

  // UI state
  setDegraded: (degraded: boolean) => void;
  setInstallGuideVisible: (visible: boolean) => void;
  setCurrentScript: (script: string) => void;
  setCurrentLanguage: (lang: 'lua' | 'javascript' | 'python') => void;
}

const invoke = async <T>(channel: string, ...args: unknown[]): Promise<{ success: boolean; data?: T; error?: string }> => {
  try {
    const result = await (window as any).electron.ipcRenderer.invoke(channel, ...args);
    return result;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
};

export const useOpenSpaceStore = create<OpenSpaceStoreState & OpenSpaceStoreActions>((set) => ({
  // Initial state
  runState: 'stopped',
  health: null,
  installation: null,
  bridgeConnected: false,
  transport: null,
  currentScript: '',
  currentLanguage: 'lua',
  scriptResult: null,
  scriptTemplates: [],
  profiles: [],
  activeProfileId: null,
  windowMode: 'standalone',
  datasets: [],
  datasetRoot: '',
  recordingState: 'idle',
  recordingSessions: [],
  currentSessionId: null,
  syncStatus: null,
  degraded: false,
  installGuideVisible: false,

  // Actions
  detectInstallation: async () => {
    const res = await invoke<InstallationInfo>('openspace:detect');
    if (res.success && res.data) {
      set({ installation: res.data, degraded: !res.data.found });
    }
  },

  setManualPath: async (path) => {
    const res = await invoke('openspace:setPath', path);
    if (!res.success) throw new Error(res.error);
  },

  startOpenSpace: async (config) => {
    set({ runState: 'starting' });
    const res = await invoke('openspace:start', config);
    if (res.success) {
      set({ runState: 'running' });
    } else {
      set({ runState: 'error' });
      throw new Error(res.error);
    }
  },

  stopOpenSpace: async () => {
    set({ runState: 'stopping' });
    const res = await invoke('openspace:stop');
    if (res.success) {
      set({ runState: 'stopped', bridgeConnected: false });
    } else {
      set({ runState: 'error' });
    }
  },

  executeScript: async (script, language = 'lua', timeout = 30000) => {
    set({ currentScript: script, scriptResult: null });
    const res = await invoke<ScriptResult>('openspace:execute', { script, language, timeout });
    if (res.success && res.data) {
      set({ scriptResult: res.data });
    } else {
      set({ scriptResult: { success: false, error: res.error, duration: 0 } });
    }
  },

  generateScript: async (prompt, language) => {
    const res = await invoke<{ script: string }>('openspace:generateScript', { prompt, language });
    if (res.success && res.data) {
      set({ currentScript: res.data.script });
    }
  },

  getTemplates: async () => {
    const res = await invoke<unknown[]>('openspace:getTemplates');
    if (res.success && res.data) {
      set({ scriptTemplates: res.data });
    }
  },

  listProfiles: async (dataDir) => {
    const res = await invoke<OpenSpaceProfile[]>('openspace:profile:list', dataDir);
    if (res.success && res.data) set({ profiles: res.data });
  },

  getProfile: async (name) => {
    const res = await invoke<OpenSpaceProfile>('openspace:profile:get', name);
    if (res.success && res.data) set({ activeProfileId: res.data.name });
  },

  createProfile: async (profile) => {
    await invoke('openspace:profile:create', profile);
  },

  updateProfile: async (profile) => {
    await invoke('openspace:profile:update', profile);
  },

  deleteProfile: async (name) => {
    await invoke('openspace:profile:delete', name);
  },

  hotReloadProfile: async () => {
    await invoke('openspace:profile:hotReload');
  },

  setWindowMode: async (mode) => {
    const res = await invoke('openspace:renderer:setMode', mode);
    if (res.success) set({ windowMode: mode });
  },

  setDisplay: async (displayId) => {
    await invoke('openspace:renderer:setDisplay', displayId);
  },

  scanDatasets: async (dataDir) => {
    const res = await invoke<DatasetEntry[]>('openspace:dataset:scan', dataDir);
    if (res.success && res.data) set({ datasets: res.data, datasetRoot: dataDir ?? '' });
  },

  searchDatasets: async (query) => {
    const res = await invoke<DatasetEntry[]>('openspace:dataset:search', query);
    if (res.success && res.data) set({ datasets: res.data });
  },

  loadDataset: async (name) => {
    await invoke('openspace:dataset:load', name);
  },

  unloadDataset: async (name) => {
    await invoke('openspace:dataset:unload', name);
  },

  startRecording: async (config) => {
    set({ recordingState: 'recording' });
    const res = await invoke('openspace:recording:start', config);
    if (!res.success) {
      set({ recordingState: 'idle' });
    }
  },

  stopRecording: async () => {
    const res = await invoke<RecordingSession>('openspace:recording:stop');
    if (res.success) {
      set({ recordingState: 'idle', currentSessionId: res.data?.id ?? null });
    }
  },

  pauseRecording: async () => {
    const res = await invoke('openspace:recording:pause');
    if (res.success) set({ recordingState: 'paused' });
  },

  listRecordingSessions: async () => {
    const res = await invoke<RecordingSession[]>('openspace:recording:sessions');
    if (res.success && res.data) set({ recordingSessions: res.data });
  },

  syncConnect: async (config) => {
    await invoke('openspace:sync:connect', config);
  },

  syncDisconnect: async () => {
    await invoke('openspace:sync:disconnect');
  },

  syncGetStatus: async () => {
    const res = await invoke<SyncStatus>('openspace:sync:status');
    if (res.success && res.data) set({ syncStatus: res.data });
  },

  setDegraded: (degraded) => set({ degraded }),
  setInstallGuideVisible: (visible) => set({ installGuideVisible: visible }),
  setCurrentScript: (script) => set({ currentScript: script }),
  setCurrentLanguage: (lang) => set({ currentLanguage: lang }),
}));
