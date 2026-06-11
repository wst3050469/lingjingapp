import { create } from 'zustand';
import type { ExecutionPlan, AgentExecutionState, StepProgressEvent } from '@codepilot/core/agent-mode';

interface AgentModeState {
  plan: ExecutionPlan | null;
  state: AgentExecutionState;
  stepProgress: Map<string, StepProgressEvent>;

  setPlan: (plan: ExecutionPlan) => void;
  setState: (state: AgentExecutionState) => void;
  updateStepProgress: (event: StepProgressEvent) => void;
  reset: () => void;
}

export const useAgentModeStore = create<AgentModeState>((set) => ({
  plan: null,
  state: 'planning',
  stepProgress: new Map(),

  setPlan: (plan) => set({ plan }),
  setState: (state) => set({ state }),
  updateStepProgress: (event) => set((s) => {
    const progress = new Map(s.stepProgress);
    progress.set(event.stepId, event);
    return { stepProgress: progress };
  }),
  reset: () => set({ plan: null, state: 'planning', stepProgress: new Map() }),
}));
