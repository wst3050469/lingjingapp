import { create } from 'zustand';

export interface OpenFile {
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
}

interface EditorState {
  openFiles: OpenFile[];
  activeFilePath: string | null;

  openFile: (file: OpenFile) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  markDirty: (path: string, dirty: boolean) => void;
  reloadFile: (path: string, content: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  openFiles: [],
  activeFilePath: null,

  openFile: (file) => set((state) => {
    const exists = state.openFiles.find((f) => f.path === file.path);
    if (exists) {
      return { activeFilePath: file.path };
    }
    return {
      openFiles: [...state.openFiles, file],
      activeFilePath: file.path,
    };
  }),

  closeFile: (path) => set((state) => {
    const files = state.openFiles.filter((f) => f.path !== path);
    const newActive = state.activeFilePath === path
      ? (files.length > 0 ? files[files.length - 1].path : null)
      : state.activeFilePath;
    return { openFiles: files, activeFilePath: newActive };
  }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) => set((state) => ({
    openFiles: state.openFiles.map((f) =>
      f.path === path ? { ...f, content, isDirty: true } : f
    ),
  })),

  markDirty: (path, dirty) => set((state) => ({
    openFiles: state.openFiles.map((f) =>
      f.path === path ? { ...f, isDirty: dirty } : f
    ),
  })),

  reloadFile: (path, content) => set((state) => ({
    openFiles: state.openFiles.map((f) =>
      f.path === path ? { ...f, content, isDirty: false } : f
    ),
  })),
}));
