import type { Plan, PlanStep, PlanEvent, CreatePlanInput } from './types.js';
type PlanEventListener = (event: PlanEvent) => void;
export declare function getPlanManager(): PlanManager;
export declare class PlanManager {
    private plans;
    private listeners;
    createPlan(input: CreatePlanInput): Plan;
    getPlan(id: string): Plan | undefined;
    updatePlan(id: string, updates: Partial<Plan>): Plan;
    updateStepStatus(planId: string, stepIndex: number, status: PlanStep['status'], result?: string, error?: string): Plan;
    advanceStep(planId: string): Plan;
    setPlanStatus(planId: string, status: Plan['status']): Plan;
    deletePlan(id: string): boolean;
    getCurrentPlan(workingDirectory: string): Plan | undefined;
    getAllPlans(workingDirectory: string): Plan[];
    registerPlan(plan: Plan): void;
    addEventListener(listener: PlanEventListener): () => void;
    private emitEvent;
}
export {};
//# sourceMappingURL=plan-manager.d.ts.map