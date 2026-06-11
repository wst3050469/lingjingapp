// Confirmation store - manages tool execution confirmation requests
import { create } from 'zustand';

export interface ConfirmationRequest {
  requestId: string;
  type: 'bash' | 'mcp' | 'plan';
  toolName: string;
  args: Record<string, unknown>;
  command?: string;
  planContent?: string;
  planTitle?: string;
}

interface ConfirmationState {
  request: ConfirmationRequest | null;
  setRequest: (req: ConfirmationRequest) => void;
  clearRequest: () => void;
  reply: (requestId: string, approved: boolean, feedback?: string) => void;
}

export const useConfirmationStore = create<ConfirmationState>((set, get) => ({
  request: null,

  setRequest: (req) => set({ request: req }),

  clearRequest: () => set({ request: null }),

  reply: (requestId, approved, feedback) => {
    const { request } = get();
    if (request && request.requestId === requestId) {
      window.electronAPI.agent.confirmReply(requestId, approved, feedback);
      set({ request: null });
    }
  },
}));
