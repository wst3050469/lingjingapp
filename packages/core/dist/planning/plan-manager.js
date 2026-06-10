// Plan Manager - Manages plan lifecycle and state
let _planManager = null;
export function getPlanManager() {
    if (!_planManager) {
        _planManager = new PlanManager();
    }
    return _planManager;
}
export class PlanManager {
    plans = new Map();
    listeners = [];
    createPlan(input) {
        // Cancel any existing active plan for this working directory
        const existingPlan = this.getCurrentPlan(input.workingDirectory);
        if (existingPlan && existingPlan.status !== 'completed' && existingPlan.status !== 'cancelled') {
            existingPlan.status = 'cancelled';
            existingPlan.updatedAt = Date.now();
            this.emitEvent({ type: 'plan_cancelled', planId: existingPlan.id });
        }
        const now = Date.now();
        const planId = `plan-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const steps = input.steps.map((step, index) => ({
            id: `${planId}-step-${index}`,
            title: step.title,
            description: step.description,
            files: step.files,
            commands: step.commands,
            estimatedComplexity: step.estimatedComplexity,
            status: 'pending',
        }));
        const plan = {
            id: planId,
            title: input.title,
            description: input.description,
            goals: input.goals,
            constraints: input.constraints || [],
            steps,
            status: 'draft',
            currentStepIndex: 0,
            createdAt: now,
            updatedAt: now,
            workingDirectory: input.workingDirectory,
        };
        this.plans.set(planId, plan);
        this.emitEvent({ type: 'plan_created', plan });
        return plan;
    }
    getPlan(id) {
        return this.plans.get(id);
    }
    updatePlan(id, updates) {
        const plan = this.plans.get(id);
        if (!plan) {
            throw new Error(`Plan not found: ${id}`);
        }
        Object.assign(plan, updates, { updatedAt: Date.now() });
        this.emitEvent({ type: 'plan_updated', plan });
        if (updates.status) {
            this.emitEvent({ type: 'plan_status_changed', planId: id, status: updates.status });
        }
        return plan;
    }
    updateStepStatus(planId, stepIndex, status, result, error) {
        const plan = this.plans.get(planId);
        if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
        }
        if (stepIndex < 0 || stepIndex >= plan.steps.length) {
            throw new Error(`Invalid step index: ${stepIndex}`);
        }
        const step = plan.steps[stepIndex];
        step.status = status;
        if (result !== undefined)
            step.result = result;
        if (error !== undefined)
            step.error = error;
        plan.updatedAt = Date.now();
        this.emitEvent({ type: 'plan_step_updated', planId, stepIndex, step });
        return plan;
    }
    advanceStep(planId) {
        const plan = this.plans.get(planId);
        if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
        }
        if (plan.currentStepIndex < plan.steps.length - 1) {
            plan.currentStepIndex++;
            plan.updatedAt = Date.now();
        }
        return plan;
    }
    setPlanStatus(planId, status) {
        const plan = this.plans.get(planId);
        if (!plan) {
            throw new Error(`Plan not found: ${planId}`);
        }
        plan.status = status;
        plan.updatedAt = Date.now();
        if (status === 'completed') {
            plan.completedAt = Date.now();
        }
        this.emitEvent({ type: 'plan_status_changed', planId, status });
        if (status === 'completed') {
            this.emitEvent({ type: 'plan_completed', plan });
        }
        else {
            this.emitEvent({ type: 'plan_paused', planId });
        }
        return plan;
    }
    deletePlan(id) {
        const plan = this.plans.get(id);
        if (!plan)
            return false;
        this.plans.delete(id);
        this.emitEvent({ type: 'plan_deleted', planId: id, plan });
        return true;
    }
    getCurrentPlan(workingDirectory) {
        for (const plan of this.plans.values()) {
            if (plan.workingDirectory === workingDirectory &&
                !['completed', 'cancelled'].includes(plan.status)) {
                return plan;
            }
        }
        return undefined;
    }
    getAllPlans(workingDirectory) {
        return Array.from(this.plans.values())
            .filter(p => p.workingDirectory === workingDirectory)
            .sort((a, b) => b.createdAt - a.createdAt);
    }
    registerPlan(plan) {
        this.plans.set(plan.id, plan);
    }
    addEventListener(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index !== -1) {
                this.listeners.splice(index, 1);
            }
        };
    }
    emitEvent(event) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (error) {
                console.error('Error in plan event listener:', error);
            }
        }
    }
}
//# sourceMappingURL=plan-manager.js.map