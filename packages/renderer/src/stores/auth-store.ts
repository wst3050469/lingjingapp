import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserRecord } from '../ipc/ipc-client';

interface AuthState {
  user: UserRecord | null;
  token: string | null;
  isAuthenticated: boolean;

  setAuth: (user: UserRecord, token: string) => void;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

const TOKEN_KEY = 'codepilot_auth_token';
const USER_KEY = 'codepilot_auth_user';

function clearChatOnUserChange() {
  try {
    const { useChatStore } = require('./chat-store');
    const chatStore = useChatStore.getState();
    chatStore.conversations = [];
    chatStore.messages = [];
    chatStore.currentConversationId = null;
    chatStore.isStreaming = false;
    useChatStore.setState({
      conversations: [],
      messages: [],
      currentConversationId: null,
      isStreaming: false,
    });
  } catch {}
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        const prevUser = get().user;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        if (prevUser && prevUser.id !== user.id) {
          clearChatOnUserChange();
        }
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        clearChatOnUserChange();
        set({ user: null, token: null, isAuthenticated: false });
      },

      restoreSession: async () => {
        // Helper to wrap a promise with a timeout
        const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
          return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
              reject(new Error(`${label} timed out after ${ms}ms`));
            }, ms);
            promise.then(
              (val) => { clearTimeout(timer); resolve(val); },
              (err) => { clearTimeout(timer); reject(err); },
            );
          });
        };

        // ✅ First: try to restore from localStorage (fast, reliable, no network)
        const token = localStorage.getItem(TOKEN_KEY);
        const userStr = localStorage.getItem(USER_KEY);
        let user: UserRecord | null = null;

        if (token && userStr) {
          try {
            user = JSON.parse(userStr) as UserRecord;
            if (user && user.id) {
              set({ user, token, isAuthenticated: true });
              console.log('[Auth] Restored session from localStorage');
              return;
            }
          } catch (e) {
            console.warn('[Auth] Failed to parse stored user:', e);
          }
        }

        // ❌ Fallback: verify token (with 8s timeout, IPC may hang)
        if (token) {
          try {
            const result = await withTimeout(
              window.electronAPI.auth.verify(token),
              8000,
              'auth:verify',
            );
            if (result.valid && result.user) {
              localStorage.setItem(USER_KEY, JSON.stringify(result.user));
              set({ user: result.user, token, isAuthenticated: true });
              console.log('[Auth] Restored session via verify()');
              return;
            }
          } catch (e) {
            console.warn('[Auth] verify() failed or timed out, clearing token:', e);
          }
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }

        // 🌟 Final fallback: auto-login as admin (with 8s timeout)
        try {
          const result = await withTimeout(
            window.electronAPI.auth.login('admin', 'admin123'),
            8000,
            'auth:login (auto)',
          );
          if (result.success && result.token && result.user) {
            localStorage.setItem(TOKEN_KEY, result.token);
            localStorage.setItem(USER_KEY, JSON.stringify(result.user));
            set({ user: result.user, token: result.token, isAuthenticated: true });
            console.log('[Auth] Auto-logged in as default admin user');
          }
        } catch (e) {
          // If auto-login fails/times out, still mark as done loading
          console.warn('[Auth] Auto-login as admin failed — running as guest:', e);
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
