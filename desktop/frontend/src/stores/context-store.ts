// Context store - manages state for the advanced context selector
// Shared between Quest and Chat via scope isolation

import { create } from 'zustand';
import type { MentionType, MentionItem, FolderTreeNode, RuleListItem } from '../types/mention';
import { useEditorStore } from './editor-store';

type ContextScope = 'quest' | 'chat';

interface ContextState {
  // Selector UI state
  showSelector: boolean;
  selectorType: MentionType;
  searchQuery: string;
  activeScope: ContextScope;

  // Search
  searchResults: MentionItem[];
  isSearching: boolean;

  // Recommendations
  recommendedFiles: MentionItem[];

  // Rules
  rulesList: RuleListItem[];
  rulesLoaded: boolean;

  // Folder tree
  folderTree: FolderTreeNode[];
  expandedFolders: Set<string>;

  // Selected contexts - isolated by scope
  questContexts: MentionItem[];
  chatContexts: MentionItem[];

  // Actions
  openSelector: (scope: ContextScope, type?: MentionType) => void;
  closeSelector: () => void;
  setSearchQuery: (query: string) => void;
  setSelectorType: (type: MentionType) => void;
  searchFiles: (query: string, type: 'file' | 'folder') => void;
  loadRules: () => Promise<void>;
  loadFolderTree: (path?: string) => Promise<void>;
  toggleFolder: (path: string) => Promise<void>;
  loadRecommendations: () => Promise<void>;
  selectContext: (scope: ContextScope, item: MentionItem) => Promise<void>;
  removeContext: (scope: ContextScope, id: string) => void;
  clearContexts: (scope: ContextScope) => void;
  getContexts: (scope: ContextScope) => MentionItem[];
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useContextStore = create<ContextState>((set, get) => ({
  showSelector: false,
  selectorType: 'file',
  searchQuery: '',
  activeScope: 'quest',

  searchResults: [],
  isSearching: false,

  recommendedFiles: [],

  rulesList: [],
  rulesLoaded: false,

  folderTree: [],
  expandedFolders: new Set<string>(),

  questContexts: [],
  chatContexts: [],

  openSelector: (scope, type) => set({
    showSelector: true,
    activeScope: scope,
    selectorType: type || 'file',
    searchQuery: '',
    searchResults: [],
  }),

  closeSelector: () => set({
    showSelector: false,
    searchQuery: '',
    searchResults: [],
  }),

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    const { selectorType } = get();
    if (selectorType === 'file' || selectorType === 'folder') {
      get().searchFiles(query, selectorType);
    }
  },

  setSelectorType: (type) => {
    set({ selectorType: type, searchQuery: '', searchResults: [] });
    if (type === 'rule' && !get().rulesLoaded) {
      get().loadRules();
    }
    if (type === 'folder' && get().folderTree.length === 0) {
      get().loadFolderTree();
    }
  },

  searchFiles: (query, type) => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }

    set({ isSearching: true });

    searchDebounceTimer = setTimeout(async () => {
      try {
        const results = await window.electronAPI.context.searchFiles(query, type);
        set({
          searchResults: results.map((r) => ({
            id: `${r.path}-${Date.now()}`,
            type: type === 'folder' ? 'folder' as const : 'file' as const,
            label: r.name,
            path: r.path,
            icon: r.isDirectory ? 'folder' : getFileIcon(r.name),
            size: r.size,
          })),
          isSearching: false,
        });
      } catch (error) {
        console.error('Context search failed:', error);
        set({ searchResults: [], isSearching: false });
      }
    }, 300);
  },

  loadRules: async () => {
    try {
      const rules = await window.electronAPI.context.listRules();
      set({
        rulesList: rules as RuleListItem[],
        rulesLoaded: true,
      });
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  },

  loadFolderTree: async (path?: string) => {
    try {
      const targetPath = path || await window.electronAPI.config.getWorkspace();
      if (!targetPath) return;

      const entries = await window.electronAPI.fs.readDir(targetPath);
      const nodes: FolderTreeNode[] = entries
        .filter((e: any) => e.isDirectory)
        .map((e: any) => ({
          path: e.path,
          name: e.name,
          isDirectory: true,
          children: undefined,
        }));

      if (!path) {
        // Root level
        set({ folderTree: nodes });
      }
    } catch (error) {
      console.error('Failed to load folder tree:', error);
    }
  },

  toggleFolder: async (path: string) => {
    const { expandedFolders, folderTree } = get();
    const newExpanded = new Set(expandedFolders);

    if (newExpanded.has(path)) {
      newExpanded.delete(path);
      set({ expandedFolders: newExpanded });
      return;
    }

    newExpanded.add(path);

    // Load children if not loaded
    try {
      const entries = await window.electronAPI.fs.readDir(path);
      const children: FolderTreeNode[] = entries
        .filter((e: any) => e.isDirectory)
        .map((e: any) => ({
          path: e.path,
          name: e.name,
          isDirectory: true,
          children: undefined,
        }));

      // Update the tree node with children
      const updateNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
        return nodes.map((node) => {
          if (node.path === path) {
            return { ...node, children };
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) };
          }
          return node;
        });
      };

      set({
        folderTree: updateNode(folderTree),
        expandedFolders: newExpanded,
      });
    } catch (error) {
      console.error('Failed to expand folder:', error);
      set({ expandedFolders: newExpanded });
    }
  },

  loadRecommendations: async () => {
    const editorState = useEditorStore.getState();
    const items: MentionItem[] = [];
    const seenPaths = new Set<string>();

    // 1. Active file (highest priority)
    if (editorState.activeFilePath) {
      const activeFile = editorState.openFiles.find((f) => f.path === editorState.activeFilePath);
      if (activeFile) {
        seenPaths.add(activeFile.path);
        items.push({
          id: `active-${activeFile.path}`,
          type: 'file',
          label: activeFile.name,
          path: activeFile.path,
          icon: getFileIcon(activeFile.name),
          source: 'active',
        });
      }
    }

    // 2. Other open files
    for (const file of editorState.openFiles) {
      if (seenPaths.has(file.path)) continue;
      seenPaths.add(file.path);
      items.push({
        id: `open-${file.path}`,
        type: 'file',
        label: file.name,
        path: file.path,
        icon: getFileIcon(file.name),
        source: 'open',
      });
    }

    // 3. Recent files from git
    try {
      const recentFiles = await window.electronAPI.context.recentFiles(10);
      for (const file of recentFiles) {
        if (seenPaths.has(file.path)) continue;
        seenPaths.add(file.path);
        items.push({
          id: `recent-${file.path}`,
          type: 'file',
          label: file.name,
          path: file.path,
          icon: getFileIcon(file.name),
          source: 'recent',
        });
      }
    } catch { /* ignore */ }

    // 4. Git changed files
    try {
      const changedFiles = await window.electronAPI.context.gitChangedFiles();
      for (const file of changedFiles) {
        if (seenPaths.has(file.path)) continue;
        seenPaths.add(file.path);
        items.push({
          id: `git-${file.path}`,
          type: 'file',
          label: file.name,
          path: file.path,
          icon: getFileIcon(file.name),
          source: 'git-changed',
        });
      }
    } catch { /* ignore */ }

    set({ recommendedFiles: items });
  },

  selectContext: async (scope, item) => {
    const key = scope === 'quest' ? 'questContexts' : 'chatContexts';
    const current = get()[key];

    // Prevent duplicates
    if (current.find((c) => c.path === item.path)) return;

    // For attachments, parse document content
    if (item.type === 'attachments' && !item.content) {
      try {
        const result = await window.electronAPI.context.parseDocument(item.path);
        item = { ...item, content: result.content };
      } catch (error) {
        console.error('Failed to parse attachment:', error);
      }
    }

    set({ [key]: [...current, item] });
  },

  removeContext: (scope, id) => {
    const key = scope === 'quest' ? 'questContexts' : 'chatContexts';
    set({ [key]: get()[key].filter((c) => c.id !== id) });
  },

  clearContexts: (scope) => {
    const key = scope === 'quest' ? 'questContexts' : 'chatContexts';
    set({ [key]: [] });
  },

  getContexts: (scope) => {
    return scope === 'quest' ? get().questContexts : get().chatContexts;
  },
}));

// Helper: get file icon type from filename
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    ts: 'typescript', tsx: 'react', js: 'javascript', jsx: 'react',
    py: 'python', rs: 'rust', go: 'go', java: 'java',
    css: 'css', scss: 'css', html: 'html', vue: 'vue',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', txt: 'text', sh: 'shell', bash: 'shell',
    sql: 'sql', graphql: 'graphql', proto: 'protobuf',
    dockerfile: 'docker', svg: 'image', png: 'image', jpg: 'image',
  };
  return iconMap[ext] || 'file';
}
