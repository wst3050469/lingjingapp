import { useState, useEffect } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { StatusBar } from './components/layout/StatusBar';
import { TopBar } from './components/layout/TopBar';
import { ActivityBar } from './components/layout/ActivityBar';
import { SidebarContainer } from './components/layout/SidebarContainer';
import { EditorArea } from './components/layout/EditorArea';
import { QuestView } from './components/quest/QuestView';
import { WikiPanel } from './components/wiki/WikiPanel';
import { AuthScreen } from './components/auth/AuthScreen';
import { SettingsModal } from './components/settings/SettingsModal';
import { SSHConnectionDialog } from './components/remote/SSHConnectionDialog';
import { RemoteFolderPicker } from './components/remote/RemoteFolderPicker';
import { ExpertCanvasModal } from './components/chat/ExpertCanvasModal';
import { UpdateNotification } from './components/layout/UpdateNotification';
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { useAuthStore } from './stores/auth-store';
import { useUIStore } from './stores/ui-store';
import { useChatStore, saveSessionSnapshot } from './stores/chat-store';
import { useAgentEvents } from './hooks/useAgentEvents';
import { useQuestEvents } from './hooks/useQuestEvents';
import { useWikiEvents } from './hooks/useWikiEvents';
import { useCloudRelay } from './hooks/useCloudRelay';
import { ThemeProvider } from './contexts/ThemeContext';
import { announce } from './hooks/useAccessibility';

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { isAuthenticated, restoreSession } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time init: IPC log listener
  useEffect(() => {
    // Listen for startup logs from main process
    if (window.electronAPI?.app?.onLog) {
      const unsubscribe = window.electronAPI.app.onLog((data: any) => {
        console.log('[Main Process]', data.message);
      });
      return () => unsubscribe();
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time sandbox check
  useEffect(() => {
    if (!window.electronAPI) {
      console.warn('[App] electronAPI bridge not loaded — running outside Electron or preload script failed');
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time auth restore on mount
  useEffect(() => {
    let cancelled = false;

    // Outer timeout safeguard: if restoreSession hangs beyond 12s, force-load UI
    const forceTimer = setTimeout(() => {
      if (!cancelled) {
        console.warn('[App] restoreSession timed out (12s) — forcing UI load');
        setLoading(false);
      }
    }, 12000);

    // Small delay ensures IPC bridge is ready before auth restore
    const timer = setTimeout(() => {
      restoreSession().finally(() => {
        if (cancelled) return;
        clearTimeout(forceTimer);
        setLoading(false);
        const { user } = useAuthStore.getState();
        if (user?.id) {
          console.log('[App] Auth restored, auto-restoring session for user:', user.id);
          useChatStore.getState().tryAutoRestoreSession(user.id).catch((err) => {
            console.warn('[App] tryAutoRestoreSession failed:', err);
            useChatStore.getState().loadConversationList(user.id).catch(() => {});
          });
        } else {
          console.log('[App] No authenticated user, creating new conversation');
          useChatStore.getState().createNewConversation();
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
    };
  }, []);

  // BUG-024: Save session snapshot on beforeunload (best-effort only).
  // The primary save path is via electronAPI window:before-close (below).
  // beforeunload fires synchronously - async IPC may not complete in time.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time listener registration
  useEffect(() => {
    const handleBeforeUnload = (_event: BeforeUnloadEvent) => {
      const chatStore = useChatStore.getState();
      const authStore = useAuthStore.getState();

      if (chatStore.messages.length === 0) {
        return;
      }

      console.log('[App] beforeunload triggered, messages:', chatStore.messages.length);

      // Best-effort: save snapshot to localStorage (sync)
      try {
        saveSessionSnapshot(chatStore);
      } catch (err) {
        console.error('[App] Failed to save session snapshot:', err);
      }

      // BUG-024: Do NOT attempt async saveSync here — it will not complete before page closes.
      // Electron window:before-close handler (below) handles proper async save.
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.app?.onWindowBeforeClose) {
      return;
    }

    const unsubscribe = window.electronAPI.app.onWindowBeforeClose(async () => {
      console.log('[App] Received window:before-close from main, saving conversation');

      try {
        const chatStore = useChatStore.getState();
        const authStore = useAuthStore.getState();

        if (chatStore.currentConversationId && chatStore.messages.length > 0) {
          console.log('[App] Force saving conversation:', chatStore.currentConversationId);
          await chatStore.saveCurrentConversation(authStore.user?.id ?? 0);
        }

        if (chatStore.messages.length > 0) {
          saveSessionSnapshot(chatStore);
        }

        window.electronAPI.app.confirmWindowClose();
        console.log('[App] Sent window:close-confirmed to main');

      } catch (err) {
        console.error('[App] Error during window:before-close handling:', err);
        window.electronAPI.app.confirmWindowClose();
      }
    });

    return () => unsubscribe();
  }, []);

  // Also save on visibility change (tab/window hidden = potential close)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const state = useChatStore.getState();
        if (state.messages.length > 0) {
          console.log('[App] Visibility hidden, saving session snapshot');
          saveSessionSnapshot(state);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-[#0f0f1a] via-[#1a1a2e] to-[#16213e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-5 animate-in fade-in">
          <div className="relative">
            <div className="w-16 h-16 border-[3px] border-cp-accent/30 border-t-cp-accent rounded-full animate-spin" />
            <div className="absolute inset-0 w-16 h-16 border-[3px] border-transparent border-b-blue-400/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xl font-bold bg-gradient-to-r from-cp-accent to-blue-400 bg-clip-text text-transparent">灵境</span>
            <span className="text-sm text-neutral-400">正在加载...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return <MainLayout />;
}

function MainLayout() {
  const { viewMode, showSidebar, showWikiPanel, showSettingsModal, showRemoteFolderPicker } = useUIStore();
  const update = useAutoUpdate();

  // Centralized agent event subscription (single instance for all chat surfaces)
  useAgentEvents();
  // Cloud relay handler: processes mobile→cloud→desktop messages
  useCloudRelay();

  // Quest mode event subscription (independent from agent events)
  useQuestEvents();

  // Wiki event subscription
  useWikiEvents();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+N: New conversation
      if (ctrl && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        useChatStore.getState().createNewConversation();
      }
      // Ctrl+L: Open chat panel and focus input
      if (ctrl && !e.shiftKey && e.key === 'l') {
        e.preventDefault();
        const uiStore = useUIStore.getState();
        // Ensure sidebar is visible with chat panel active
        if (!uiStore.showSidebar || uiStore.activeSidebarPanel !== 'chat') {
          uiStore.setSidebarPanel('chat');
          if (!uiStore.showSidebar) uiStore.toggleSidebar();
        }
        // Focus the chat input after a brief delay for DOM update
        setTimeout(() => {
          const textarea = document.querySelector<HTMLTextAreaElement>('[data-chat-input]');
          textarea?.focus();
        }, 50);
      }
      // Escape: Abort streaming
      if (e.key === 'Escape') {
        const { isStreaming } = useChatStore.getState();
        if (isStreaming) {
          e.preventDefault();
          window.electronAPI.agent.abort().catch(() => {});
        }
      }
      // Ctrl+,: Open settings
      if (ctrl && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        useUIStore.getState().setShowSettingsModal(true);
      }
      // Ctrl+B: Toggle sidebar
      if (ctrl && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        useUIStore.getState().toggleSidebar();
      }
      // Ctrl+J: Toggle bottom panel
      if (ctrl && !e.shiftKey && e.key === 'j') {
        e.preventDefault();
        useUIStore.getState().toggleBottomPanel();
      }
      // Ctrl+Shift+E: Explorer
      if (ctrl && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        useUIStore.getState().setSidebarPanel('explorer');
      }
      // Ctrl+Shift+F: Search
      if (ctrl && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        useUIStore.getState().setSidebarPanel('search');
      }
      // Ctrl+Shift+A: AI Chat sidebar
      if (ctrl && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        useUIStore.getState().setSidebarPanel('chat');
      }
      // Ctrl+Shift+G: Git
      if (ctrl && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        useUIStore.getState().setSidebarPanel('git');
      }
      // Ctrl+Shift+R: Remote
      if (ctrl && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        useUIStore.getState().setSidebarPanel('remote');
      }
      // Ctrl+`: Toggle terminal in bottom panel
      if (ctrl && e.key === '`') {
        e.preventDefault();
        const store = useUIStore.getState();
        if (store.showBottomPanel && store.activeBottomTab === 'terminal') {
          store.toggleBottomPanel();
        } else {
          store.openBottomPanel('terminal');
        }
      }
      // Ctrl+Shift+Q: Toggle Quest Mode
      if (ctrl && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        const store = useUIStore.getState();
        store.setViewMode(store.viewMode === 'quest' ? 'editor' : 'quest');
      }
      // Ctrl+Shift+W: Workflow Panel
      if (ctrl && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        useUIStore.getState().setSidebarPanel('workflow');
      }
      // Ctrl+Shift+O: Toggle Wiki Panel
      if (ctrl && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        useUIStore.getState().toggleWikiPanel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-cp-bg">
      {/* Top Bar with menus + Editor/Quest tabs */}
      <TopBar />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'editor' ? (
          <>
            {/* Activity Bar (far left icons) */}
            <ActivityBar />

            {/* Sidebar + Editor Area with resizable split */}
            <div className="flex-1 overflow-hidden min-w-0">
              <Allotment proportionalLayout={false} className="h-full w-full">
                {showSidebar && (
                  <Allotment.Pane preferredSize={260} minSize={170} maxSize={500} snap>
                    <SidebarContainer />
                  </Allotment.Pane>
                )}
                <Allotment.Pane minSize={300}>
                  <EditorArea />
                </Allotment.Pane>
                {showWikiPanel && (
                  <Allotment.Pane preferredSize={420} minSize={300} maxSize={800} snap>
                    <WikiPanel />
                  </Allotment.Pane>
                )}
              </Allotment>
            </div>
          </>
        ) : (
          /* Quest mode: Full-screen quest view */
          <QuestView />
        )}
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Settings Modal overlay */}
      {showSettingsModal && <SettingsModal />}

      {/* Remote Folder Picker */}
      {showRemoteFolderPicker && <RemoteFolderPicker />}

      {/* Expert Canvas Modal overlay */}
      <ExpertCanvasModal />

      {/* Update Notification */}
      <UpdateNotification
        update={update}
        onDownload={update.downloadUpdate}
        onInstall={update.installUpdate}
        onDismiss={update.dismiss}
        onDismissSuppress={update.dismissAndSuppress}
      />
    </div>
  );
}
