// 灵境IDE 移动端 - 全局状态管理 (Zustand)
// 合并 lingjing-mobile/app-store.ts + mobile/store.ts 全部字段
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

export interface QuestTask {
  id: string;
  title: string;
  status: string;
  scenario: string;
  created_at: string;
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  status: string;
  current_step: number;
  created_at: string;
  updated_at: string;
}

export interface PlanDetail extends Plan {
  goals: string[];
  constraints?: string[];
  steps: { index: number; title: string; status: string }[];
}

interface SessionDetail {
  id: string;
  title: string;
  created_at: string;
  messages: Message[];
}

interface DeviceStatus {
  device: string;
  platform: string;
  uptime: number;
  memory: { total: number; free: number };
  cpu: string;
  stats: {
    conversations: number;
    quest_tasks: number;
    plans: number;
    mobile_clients: number;
  };
  version: string;
}

// ── Subscription Types ──
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
  features: { name: string; desc: string; included: boolean }[];
  limits: Record<string, number>;
  recommended: number;
}

export interface SubscriptionInfo {
  id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  started_at: string;
  expires_at: string;
  usage: {
    apiCalls: number;
    sessions: number;
    memories: number;
    storageFiles: number;
    apiKeys: number;
    limits: Record<string, number>;
  };
}

// ── Schedule Types (移植自 mobile/store.ts) ──
export interface Schedule {
  id: string;
  name: string;
  cron_expr: string;
  action_type: string;
  status: string;
  last_run: string | null;
  next_run: string | null;
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
  mode: 'lan' | 'cloud' | 'cloud_account';
  baseUrl: string;
  setConnection: (connected: boolean, mode: 'lan' | 'cloud' | 'cloud_account', baseUrl: string) => void;

  // Device status
  status: DeviceStatus | null;
  setStatus: (s: DeviceStatus) => void;

  // Sessions
  sessions: Session[];
  selectedSession: SessionDetail | null;
  setSessions: (s: Session[]) => void;
  setSelectedSession: (s: SessionDetail | null) => void;

  // Quest tasks
  tasks: QuestTask[];
  setTasks: (t: QuestTask[]) => void;

  // Plans (quest plans)
  plans: Plan[];
  setPlans: (p: Plan[]) => void;

  // Subscription
  subscription: SubscriptionInfo | null;
  subscriptionPlans: SubscriptionPlan[];
  setSubscription: (s: SubscriptionInfo | null) => void;
  setSubscriptionPlans: (p: SubscriptionPlan[]) => void;

  // Schedules (移植自 mobile/store.ts)
  schedules: Schedule[];
  setSchedules: (s: Schedule[]) => void;

  // Cloud connection (移植自 mobile/store.ts)
  cloudConnected: boolean;
  setCloudConnected: (connected: boolean) => void;

  // UI (移植自 mobile/store.ts)
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Settings
  token: string;
  setToken: (t: string) => void;
  lanIp: string;
  setLanIp: (ip: string) => void;

  // Auth (移植自 mobile/store.ts)
  isAuthenticated: boolean;
  deviceId: string | null;
  user: UserInfo | null;
  setAuth: (deviceId: string, token: string) => void;
  setUser: (user: UserInfo) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  connected: false,
  mode: 'lan',
  baseUrl: '',
  setConnection: (connected, mode, baseUrl) => set({ connected, mode, baseUrl }),

  status: null,
  setStatus: (status) => set({ status }),

  sessions: [],
  selectedSession: null,
  setSessions: (sessions) => set({ sessions }),
  setSelectedSession: (session) => set({ selectedSession: session }),

  tasks: [],
  setTasks: (tasks) => set({ tasks }),

  plans: [],
  setPlans: (plans) => set({ plans }),

  subscription: null,
  subscriptionPlans: [],
  setSubscription: (subscription) => set({ subscription }),
  setSubscriptionPlans: (subscriptionPlans) => set({ subscriptionPlans }),

  // === 新增: 移植自 mobile/store.ts ===
  schedules: [],
  setSchedules: (schedules) => set({ schedules }),

  cloudConnected: false,
  setCloudConnected: (cloudConnected) => set({ cloudConnected }),

  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),

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
      token: '', connected: false, mode: 'lan',
    });
  },

  token: '',
  setToken: (token) => set({ token }),
  lanIp: '',
  setLanIp: (lanIp) => set({ lanIp }),
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
