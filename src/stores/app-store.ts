// 灵境IDE 移动端轻量版 - 全局状态管理 (Zustand)
// v2: 精简为纯对话，移除任务/计划/订阅/定时/设备状态
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_TOKEN = 'lingjing_mobile_token';
const STORAGE_KEY_USER = 'lingjing_mobile_user';

export interface Session {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
}

export interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_calls?: any;
  created_at: string;
}

interface SessionDetail {
  id: string;
  title: string;
  created_at: string;
  messages: Message[];
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  registeredAt?: string;
}

interface AppState {
  // Connection
  connected: boolean;
  mode: 'cloud_account';
  baseUrl: string;
  setConnection: (connected: boolean, mode: 'cloud_account', baseUrl: string) => void;

  // Sessions
  sessions: Session[];
  selectedSession: SessionDetail | null;
  setSessions: (s: Session[]) => void;
  setSelectedSession: (s: SessionDetail | null) => void;

  // Auth
  token: string;
  setToken: (t: string) => void;
  isAuthenticated: boolean;
  deviceId: string | null;
  user: UserInfo | null;
  setAuth: (deviceId: string, token: string) => void;
  setUser: (user: UserInfo) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  connected: false,
  mode: 'cloud_account',
  baseUrl: '',
  setConnection: (connected, mode, baseUrl) => set({ connected, mode, baseUrl }),

  sessions: [],
  selectedSession: null,
  setSessions: (sessions) => set({ sessions }),
  setSelectedSession: (session) => set({ selectedSession: session }),

  token: '',
  setToken: (token) => set({ token }),

  isAuthenticated: false,
  deviceId: null,
  user: null,
  setAuth: (deviceId, token) => {
    AsyncStorage.setItem(STORAGE_KEY_TOKEN, token).catch(() => {});
    set({ isAuthenticated: true, deviceId, token });
  },
  setUser: (user) => {
    AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user)).catch(() => {});
    set({ user });
  },
  logout: () => {
    AsyncStorage.removeItem(STORAGE_KEY_TOKEN).catch(() => {});
    AsyncStorage.removeItem(STORAGE_KEY_USER).catch(() => {});
    set({
      isAuthenticated: false, deviceId: null, user: null,
      token: '', connected: false,
    });
  },
}));

// ── Persistence helpers (AsyncStorage) ──
export async function loadPersistedAuth(): Promise<{ token: string; user: UserInfo | null } | null> {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
    if (!token) return null;
    const userJson = await AsyncStorage.getItem(STORAGE_KEY_USER);
    const user = userJson ? JSON.parse(userJson) : null;
    return { token, user };
  } catch {
    return null;
  }
}

export async function clearPersistedAuth(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
    await AsyncStorage.removeItem(STORAGE_KEY_USER);
  } catch { /* ignore */ }
}
