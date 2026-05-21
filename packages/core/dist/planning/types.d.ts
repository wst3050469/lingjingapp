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
export type PlanEvent = {
    type: 'plan_created';
    plan: Plan;
} | {
    type: 'plan_updated';
    plan: Plan;
} | {
    type: 'plan_status_changed';
    planId: string;
    status: Plan['status'];
} | {
    type: 'plan_step_updated';
    planId: string;
    stepIndex: number;
    step: PlanStep;
} | {
    type: 'plan_completed';
    plan: Plan;
} | {
    type: 'plan_paused';
    planId: string;
} | {
    type: 'plan_cancelled';
    planId: string;
} | {
    type: 'plan_deleted';
    planId: string;
    plan: Plan;
};
export interface CreatePlanInput {
    title: string;
    description: string;
    goals: string[];
    constraints?: string[];
    steps: Array<{
        title: string;
        description: string;
        files?: string[];
        commands?: string[];
        estimatedComplexity?: 'low' | 'medium' | 'high';
    }>;
    workingDirectory: string;
}
//# sourceMappingURL=types.d.ts.map