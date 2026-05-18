import { create } from 'zustand';

export interface ExpertTask {
  id: string;
  expertType: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: string;
  result?: string;
  isError?: boolean;
  startedAt?: number;
  completedAt?: number;
}

export interface InterventionRecord {
  id: string;
  text: string;
  timestamp: number;
  injected: boolean;
}

export interface ExpertsState {
  phase: 'idle' | 'planning' | 'dispatching' | 'integrating' | 'done';
  tasks: ExpertTask[];
  dispatchSummary: { total: number; succeeded: number; failed: number } | null;

  // Canvas state
  showCanvas: boolean;
  focusedExpertId: string | null;

  // Intervention history
  interventions: InterventionRecord[];

  setPhase: (phase: ExpertsState['phase']) => void;
  startDispatch: (tasks: ExpertTask[]) => void;
  updateTaskStatus: (taskId: string, status: ExpertTask['status'], result?: string, isError?: boolean) => void;
  appendTaskProgress: (taskId: string, text: string) => void;
  setDispatchSummary: (summary: { total: number; succeeded: number; failed: number }) => void;
  openCanvas: (focusExpertId?: string) => void;
  closeCanvas: () => void;
  setFocusedExpert: (expertId: string | null) => void;
  addIntervention: (text: string) => void;
  markInterventionInjected: (id: string) => void;
  reset: () => void;
}

export const useExpertsStore = create<ExpertsState>((set) => ({
  phase: 'idle',
  tasks: [],
  dispatchSummary: null,
  showCanvas: false,
  focusedExpertId: null,
  interventions: [],

  setPhase: (phase) => set({ phase }),

  startDispatch: (tasks) =>
    set({
      phase: 'dispatching',
      tasks,
      dispatchSummary: null,
    }),

  updateTaskStatus: (taskId, status, result, isError) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              result: result ?? t.result,
              isError: isError ?? t.isError,
              startedAt: status === 'running' ? Date.now() : t.startedAt,
              completedAt: status === 'completed' || status === 'failed' ? Date.now() : t.completedAt,
            }
          : t
      ),
    })),

  appendTaskProgress: (taskId, text) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, progress: t.progress + text } : t
      ),
    })),

  setDispatchSummary: (summary) =>
    set({
      phase: 'done',
      dispatchSummary: summary,
    }),

  openCanvas: (focusExpertId) =>
    set({
      showCanvas: true,
      focusedExpertId: focusExpertId ?? null,
    }),

  closeCanvas: () =>
    set({
      showCanvas: false,
      focusedExpertId: null,
    }),

  setFocusedExpert: (expertId) =>
    set({ focusedExpertId: expertId }),

  addIntervention: (text) =>
    set((state) => ({
      interventions: [
        ...state.interventions,
        { id: `int-${Date.now()}`, text, timestamp: Date.now(), injected: false },
      ],
    })),

  markInterventionInjected: (id) =>
    set((state) => ({
      interventions: state.interventions.map((i) =>
        i.id === id ? { ...i, injected: true } : i
      ),
    })),

  reset: () =>
    set({
      phase: 'idle',
      tasks: [],
      dispatchSummary: null,
      showCanvas: false,
      focusedExpertId: null,
      interventions: [],
    }),
}));
