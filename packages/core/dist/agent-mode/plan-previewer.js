export class PlanPreviewer {
    preview(instruction, steps) {
        return {
            id: `plan_${Date.now()}`,
            instruction,
            steps,
            createdAt: new Date(),
            totalSteps: steps.length,
            completedSteps: 0,
        };
    }
    reorderSteps(plan, fromIndex, toIndex) {
        const steps = [...plan.steps];
        const [moved] = steps.splice(fromIndex, 1);
        steps.splice(toIndex, 0, moved);
        return { ...plan, steps };
    }
    skipStep(plan, stepId) {
        return {
            ...plan,
            steps: plan.steps.map(s => s.id === stepId ? { ...s, status: 'skipped' } : s),
        };
    }
}
//# sourceMappingURL=plan-previewer.js.map