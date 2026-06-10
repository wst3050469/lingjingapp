import { create } from 'zustand';

export interface SelectionRange {
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
}

interface OpenParams {
  filePath: string;
  language: string;
  scenario: 'modify' | 'add';
  selectedCode?: string;
  selectionRange?: SelectionRange;
  cursorLine?: number;
}

interface InlineChatState {
  isOpen: boolean;
  isGenerating: boolean;
  filePath: string | null;
  language: string | null;
  scenario: 'modify' | 'add' | null;
  selectedCode: string | null;
  selectionRange: SelectionRange | null;
  cursorLine: number | null;
  promptText: string;
  contextFiles: string[];
  generatedCode: string | null;
  error: string | null;

  open: (params: OpenParams) => void;
  setPromptText: (text: string) => void;
  addContextFile: (path: string) => void;
  removeContextFile: (path: string) => void;
  setGenerating: (val: boolean) => void;
  setGeneratedCode: (code: string) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const initialState = {
  isOpen: false,
  isGenerating: false,
  filePath: null as string | null,
  language: null as string | null,
  scenario: null as 'modify' | 'add' | null,
  selectedCode: null as string | null,
  selectionRange: null as SelectionRange | null,
  cursorLine: null as number | null,
  promptText: '',
  contextFiles: [] as string[],
  generatedCode: null as string | null,
  error: null as string | null,
};

export const useInlineChatStore = create<InlineChatState>((set) => ({
  ...initialState,

  open: (params) =>
    set({
      isOpen: true,
      isGenerating: false,
      filePath: params.filePath,
      language: params.language,
      scenario: params.scenario,
      selectedCode: params.selectedCode ?? null,
      selectionRange: params.selectionRange ?? null,
      cursorLine: params.cursorLine ?? null,
      promptText: '',
      contextFiles: [],
      generatedCode: null,
      error: null,
    }),

  setPromptText: (text) => set({ promptText: text }),

  addContextFile: (path) =>
    set((state) => ({
      contextFiles: state.contextFiles.includes(path)
        ? state.contextFiles
        : [...state.contextFiles, path],
    })),

  removeContextFile: (path) =>
    set((state) => ({
      contextFiles: state.contextFiles.filter((f) => f !== path),
    })),

  setGenerating: (val) => set({ isGenerating: val, error: null }),
  setGeneratedCode: (code) => set({ generatedCode: code, isGenerating: false }),
  setError: (msg) => set({ error: msg, isGenerating: false }),
  reset: () => set(initialState),
}));
