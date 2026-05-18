import { useEffect } from 'react';
import { usePlanStore } from '../stores/plan-store';
import { useAgentEvents } from './useAgentEvents';

export function usePlanningEvents() {
  const { setCurrentPlan, updatePlan, setPlans } = usePlanStore();

  // Listen to agent events for plan updates
  useEffect(() => {
    const cleanup = window.electronAPI.agent.onEvent((event: any) => {
      switch (event.type) {
        case 'plan_created':
        case 'plan_updated':
          setCurrentPlan(event.plan);
          // Also update in plans list
          const plans = usePlanStore.getState().plans;
          const existingIndex = plans.findIndex(p => p.id === event.plan.id);
          if (existingIndex >= 0) {
            const updatedPlans = [...plans];
            updatedPlans[existingIndex] = event.plan;
            setPlans(updatedPlans);
          } else {
            setPlans([...plans, event.plan]);
          }
          break;
        case 'plan_status_changed':
          const plan = usePlanStore.getState().currentPlan;
          if (plan && plan.id === event.planId) {
            updatePlan({ ...plan, status: event.status });
          }
          break;
        case 'plan_step_updated':
          const currentPlan = usePlanStore.getState().currentPlan;
          if (currentPlan && currentPlan.id === event.planId) {
            const updatedSteps = [...currentPlan.steps];
            updatedSteps[event.stepIndex] = event.step;
            updatePlan({ ...currentPlan, steps: updatedSteps });
          }
          break;
        case 'plan_completed':
          const completedPlan = usePlanStore.getState().currentPlan;
          if (completedPlan) {
            updatePlan({ ...completedPlan, status: 'completed' });
          }
          break;
        case 'plan_paused':
        case 'plan_cancelled':
          const pausedPlan = usePlanStore.getState().currentPlan;
          if (pausedPlan && pausedPlan.id === event.planId) {
            updatePlan({
              ...pausedPlan,
              status: event.type === 'plan_paused' ? 'paused' : 'cancelled',
            });
          }
          break;
      }
    });

    return cleanup;
  }, [setCurrentPlan, updatePlan, setPlans]);
}
