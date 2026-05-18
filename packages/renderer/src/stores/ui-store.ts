import { create } from 'zustand';

type ViewMode = 'editor' | 'quest';
export type SidebarPanel = 'explorer' | 'search' | 'chat' | 'git' | 'run-debug' | 'extension' | 'remote' | 'workflow' | 'admin' | 'pipeline' | 'review' | 'pm' | 'security';
export type BottomTab = 'terminal' | 'problems' | 'chat' | 'ssh-terminal';
export type TopTab = 'Spec' | 'Changed Files' | 'Preview';
export type ThemeMode = 'dark' | 'light';

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

  activeSidebarPanel: 'explorer',
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
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
    set({ theme });
  },

  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', newTheme);
    return { theme: newTheme };
  }),

  setSidebarPanel: (panel) => set((s) => {
    if (s.showSidebar && s.activeSidebarPanel === panel) {
      return { showSidebar: false };
    }
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
