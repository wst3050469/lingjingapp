import { create } from 'zustand';
import type { FileEntry } from '../ipc/ipc-client';
import { useRemoteContextStore } from './remote-context-store';

interface FileState {
  workspacePath: string | null;
  fileTree: FileEntry[];
  expandedPaths: Set<string>;

  setWorkspacePath: (path: string | null) => void;
  setFileTree: (tree: FileEntry[]) => void;
  toggleExpanded: (path: string) => void;
  
  // Remote-aware file operations
  readDir: (path: string) => Promise<FileEntry[]>;
  readFile: (path: string) => Promise<{ content: string; language: string }>;
  writeFile: (path: string, content: string) => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  workspacePath: null,
  fileTree: [],
  expandedPaths: new Set<string>(),

  setWorkspacePath: (path) => set({ workspacePath: path }),
  setFileTree: (tree) => set({ fileTree: tree }),
  toggleExpanded: (path) => set((state) => {
    const next = new Set(state.expandedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return { expandedPaths: next };
  }),

  // Remote-aware file operations - route to SFTP or local based on context
  readDir: async (path: string): Promise<FileEntry[]> => {
    const { isRemoteMode, sshTerminalId } = useRemoteContextStore.getState();
    if (isRemoteMode && sshTerminalId) {
      return await window.electronAPI.ssh.readDir(sshTerminalId, path);
    }
    return await window.electronAPI.fs.readDir(path);
  },

  readFile: async (path: string): Promise<{ content: string; language: string }> => {
    const { isRemoteMode, sshTerminalId } = useRemoteContextStore.getState();
    if (isRemoteMode && sshTerminalId) {
      return await window.electronAPI.ssh.readFile(sshTerminalId, path);
    }
    return await window.electronAPI.fs.readFile(path);
  },

  writeFile: async (path: string, content: string): Promise<void> => {
    const { isRemoteMode, sshTerminalId } = useRemoteContextStore.getState();
    if (isRemoteMode && sshTerminalId) {
      return await window.electronAPI.ssh.writeFile(sshTerminalId, path, content);
    }
    return await window.electronAPI.fs.writeFile(path, content);
  },
}));
