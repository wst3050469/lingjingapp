import { create } from 'zustand';

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  files?: string[];
  commands?: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  estimatedComplexity?: 'low' | 'medium' | 'high';
  result?: string;
  error?: string;
}

export interface Plan {
  id: string;
  title: string;
  description: string;
  goals: string[];
  constraints: string[];
  steps: PlanStep[];
  status: 'draft' | 'reviewing' | 'approved' | 'executing' | 'paused' | 'completed' | 'cancelled';
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  retrospective?: string;
  workingDirectory: string;
}

interface PlanState {
  currentPlan: Plan | null;
  plans: Plan[];
  isPanelOpen: boolean;

  setCurrentPlan: (plan: Plan | null) => void;
  updatePlan: (plan: Plan) => void;
  setPlans: (plans: Plan[]) => void;
  setPanelOpen: (open: boolean) => void;
  clearPlans: () => void;
  removePlan: (planId: string) => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  currentPlan: null,
  plans: [],
  isPanelOpen: false,

  setCurrentPlan: (plan) => set({ currentPlan: plan, isPanelOpen: plan !== null }),
  updatePlan: (plan) =>
    set((state) => ({
      currentPlan: state.currentPlan?.id === plan.id ? plan : state.currentPlan,
      plans: state.plans.map((p) => (p.id === plan.id ? plan : p)),
    })),
  setPlans: (plans) => set({ plans }),
  setPanelOpen: (open) => set({ isPanelOpen: open }),
  clearPlans: () => set({ currentPlan: null, plans: [], isPanelOpen: false }),
  removePlan: (planId: string) =>
    set((state) => ({
      plans: state.plans.filter((p) => p.id !== planId),
      currentPlan: state.currentPlan?.id === planId ? null : state.currentPlan,
      isPanelOpen: state.currentPlan?.id === planId ? false : state.isPanelOpen,
    })),
}));
