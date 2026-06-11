import { create } from 'zustand';
import type { CompletionSessionState, CompletionResult } from '@codepilot/core/completion';

interface CompletionState {
  sessionState: CompletionSessionState;
  currentSuggestion: CompletionResult | null;
  ghostText: string;
  sessionId: string | null;

  setSessionState: (state: CompletionSessionState) => void;
  setSuggestion: (result: CompletionResult | null) => void;
  setGhostText: (text: string) => void;
  reset: () => void;
}

export const useCompletionStore = create<CompletionState>((set) => ({
  sessionState: 'idle',
  currentSuggestion: null,
  ghostText: '',
  sessionId: null,

  setSessionState: (state) => set({ sessionState: state }),
  setSuggestion: (result) => set({ currentSuggestion: result, ghostText: result?.text ?? '' }),
  setGhostText: (text) => set({ ghostText: text }),
  reset: () => set({ sessionState: 'idle', currentSuggestion: null, ghostText: '', sessionId: null }),
}));
