import { create } from 'zustand';

type ViewMode = 'editor' | 'quest';
export type SidebarPanel = 'dashboard' | 'explorer' | 'search' | 'chat' | 'git' | 'run-debug' | 'extension' | 'remote' | 'workflow' | 'admin' | 'pipeline' | 'review' | 'pm' | 'security' | 'fusion-settings' | 'vector-memory' | 'dag-canvas' | 'multi-agent' | 'model-router' | 'cron-scheduler' | 'review-report' | 'user-profile' | 'openspace' | 'openspace-script' | 'openspace-dataset' | 'openspace-profile' | 'openspace-recorder';
export type BottomTab = 'terminal' | 'problems' | 'chat' | 'ssh-terminal';
export type TopTab = 'Spec' | 'Changed Files' | 'Preview';
export type ThemeMode = 'dark' | 'light' | 'scifi-dark';

interface UIState {
  viewMode: ViewMode;
  showSettingsModal: boolean;
  theme: ThemeMode;

  // Sidebar (left)
  activeSidebarPanel: SidebarPanel;
  showSidebar: boolean;

  // Bottom panel
  showBottomPanel: boolean;
  activeBottomTab: BottomTab;

  // Top tab bar (Spec / Changed Files / Preview)
  activeTopTab: TopTab;

  // Wiki panel (right)
  showWikiPanel: boolean;

  // Right panel (detail / terminal panel on the right)
  showRightPanel: boolean;

  // Remote folder picker
  showRemoteFolderPicker: boolean;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setShowSettingsModal: (show: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setShowRemoteFolderPicker: (show: boolean) => void;

  // VS Code-style sidebar toggle: click active icon = hide, click inactive = switch (+ show if hidden)
  setSidebarPanel: (panel: SidebarPanel) => void;
  toggleSidebar: () => void;

  toggleBottomPanel: () => void;
  openBottomPanel: (tab: BottomTab) => void;
  setActiveBottomTab: (tab: BottomTab) => void;

  // Top tab bar actions
  setActiveTopTab: (tab: TopTab) => void;

  toggleWikiPanel: () => void;
  openRightPanel: (tab: string) => void;
  toggleRightPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'editor',
  showSettingsModal: false,
  theme: 'dark',

  activeSidebarPanel: (() => {
    try {
      const saved = localStorage.getItem('last_sidebar_panel');
      const valid: SidebarPanel[] = ['dashboard','explorer','search','chat','git','run-debug','extension','remote','workflow','admin','pipeline','review','pm','security','fusion-settings','vector-memory','dag-canvas','multi-agent','model-router','cron-scheduler','review-report','user-profile','openspace','openspace-script','openspace-dataset','openspace-profile','openspace-recorder'];
      if (saved && saved !== 'dashboard' && valid.includes(saved as SidebarPanel)) return saved as SidebarPanel;
    } catch {}
    return 'explorer';
  })(),
  showSidebar: true,

  showBottomPanel: false,
  activeBottomTab: 'terminal',

  activeTopTab: 'Spec',

  showWikiPanel: false,
  showRightPanel: false,
  showRemoteFolderPicker: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setShowSettingsModal: (show) => set({ showSettingsModal: show }),
  setShowRemoteFolderPicker: (show) => set({ showRemoteFolderPicker: show }),

  setTheme: (theme) => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.removeAttribute('data-theme');
    } else if (theme === 'scifi-dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'scifi-dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', theme);
    set({ theme });
  },

  toggleTheme: () => set((state) => {
    const cycle: ThemeMode[] = ['dark', 'light', 'scifi-dark'];
    const idx = cycle.indexOf(state.theme);
    const newTheme = cycle[(idx + 1) % cycle.length];
    const root = document.documentElement;
    if (newTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.removeAttribute('data-theme');
    } else if (newTheme === 'scifi-dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'scifi-dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', newTheme);
    return { theme: newTheme };
  }),

  setSidebarPanel: (panel) => set((s) => {
    if (s.showSidebar && s.activeSidebarPanel === panel) {
      return { showSidebar: false };
    }
    // 持久化最后打开的面板
    try { localStorage.setItem('last_sidebar_panel', panel); } catch {}
    return { activeSidebarPanel: panel, showSidebar: true };
  }),

  toggleSidebar: () => set((s) => ({ showSidebar: !s.showSidebar })),

  toggleBottomPanel: () => set((s) => ({ showBottomPanel: !s.showBottomPanel })),
  openBottomPanel: (tab) => set({ showBottomPanel: true, activeBottomTab: tab }),
  setActiveBottomTab: (tab) => set({ activeBottomTab: tab }),

  setActiveTopTab: (tab) => set({ activeTopTab: tab }),

  toggleWikiPanel: () => set((s) => ({ showWikiPanel: !s.showWikiPanel })),
  openRightPanel: (tab) => set({ showRightPanel: true }),
  toggleRightPanel: () => set((s) => ({ showRightPanel: !s.showRightPanel })),
}));

// Initialize theme
const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
if (savedTheme) {
  useUIStore.getState().setTheme(savedTheme);
}
