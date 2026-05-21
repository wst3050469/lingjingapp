import type { ExecutionPlan, ExecutionStep } from './types.js';
export declare class PlanPreviewer {
    preview(instruction: string, steps: ExecutionStep[]): ExecutionPlan;
    reorderSteps(plan: ExecutionPlan, fromIndex: number, toIndex: number): ExecutionPlan;
    skipStep(plan: ExecutionPlan, stepId: string): ExecutionPlan;
}
//# sourceMappingURL=plan-previewer.d.ts.map