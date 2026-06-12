// 全局状态管理 - Zustand Store
import { create } from 'zustand';

export interface UserInfo {
  id: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  displayName?: string;
}

export interface AppState {
  // Connection
  connected: boolean;
  connectionType: 'cloud_account' | 'paired' | null;
  serverUrl: string;
  setConnection: (connected: boolean, type: AppState['connectionType'], url?: string) => void;

  // Auth
  token: string | null;
  cloudToken: string | null;
  user: UserInfo | null;
  isLoggedIn: boolean;
  setAuth: (userId: string, token: string) => void;
  setUser: (user: UserInfo | null) => void;
  clearAuth: () => void;

  // Theme
  themeMode: 'system' | 'dark' | 'light';
  setThemeMode: (mode: 'system' | 'dark' | 'light') => void;

  // Notifications
  notificationSettings: {
    system: boolean;
    taskUpdates: boolean;
    approval: boolean;
    planReview: boolean;
    qa: boolean;
    taskCompleted: boolean;
  };
  setNotificationSetting: (key: keyof AppState['notificationSettings'], value: boolean) => void;

  // UI
  isComposerFocused: boolean;
  setComposerFocused: (focused: boolean) => void;

  // Active session
  activeSessionId: string | null;
  activeSessionTitle: string | null;
  setActiveSession: (id: string | null, title?: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Connection
  connected: false,
  connectionType: null,
  serverUrl: '',
  setConnection: (connected, type, url) =>
    set({ connected, connectionType: type, serverUrl: url || '' }),

  // Auth
  token: null,
  cloudToken: null,
  user: null,
  isLoggedIn: false,
  setAuth: (userId, token) =>
    set({ token, cloudToken: token, isLoggedIn: true, user: { id: userId } }),
  setUser: (user) => set({ user }),
  clearAuth: () =>
    set({ token: null, cloudToken: null, user: null, isLoggedIn: false }),

  // Theme
  themeMode: 'system',
  setThemeMode: (mode) => set({ themeMode: mode }),

  // Notifications
  notificationSettings: {
    system: true,
    taskUpdates: true,
    approval: true,
    planReview: true,
    qa: true,
    taskCompleted: true,
  },
  setNotificationSetting: (key, value) =>
    set((s) => ({
      notificationSettings: { ...s.notificationSettings, [key]: value },
    })),

  // UI
  isComposerFocused: false,
  setComposerFocused: (focused) => set({ isComposerFocused: focused }),

  // Active session
  activeSessionId: null,
  activeSessionTitle: null,
  setActiveSession: (id, title) =>
    set({ activeSessionId: id, activeSessionTitle: title || null }),
}));

// 持久化认证数据
export async function loadPersistedAuth(): Promise<{ token?: string; user?: UserInfo } | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem('lingjing_auth');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export async function savePersistedAuth(token: string, user?: UserInfo) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem('lingjing_auth', JSON.stringify({ token, user }));
  } catch {}
}

export async function clearPersistedAuth() {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem('lingjing_auth');
  } catch {}
}
