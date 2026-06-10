import { PlanPreviewer } from './plan-previewer.js';
import { StepExecutor } from './step-executor.js';
import { HumanConfirmationGate } from './human-confirmation-gate.js';
import { LoopDetector } from './loop-detector.js';
import { ExecutionInterrupter } from './execution-interrupter.js';
export class AgentModeEnhancer {
    planPreviewer;
    stepExecutor;
    confirmationGate;
    loopDetector;
    executionInterrupter;
    currentPlan = null;
    state = 'planning';
    constructor() {
        this.planPreviewer = new PlanPreviewer();
        this.stepExecutor = new StepExecutor();
        this.confirmationGate = new HumanConfirmationGate();
        this.loopDetector = new LoopDetector();
        this.executionInterrupter = new ExecutionInterrupter();
    }
    previewPlan(instruction, steps) {
        this.state = 'previewing';
        this.currentPlan = this.planPreviewer.preview(instruction, steps);
        return this.currentPlan;
    }
    async executePlan(plan, executor, onProgress) {
        this.state = 'executing';
        this.currentPlan = plan;
        const signal = this.executionInterrupter.start();
        this.stepExecutor.setProgressHandler(onProgress ?? (() => { }));
        for (let i = 0; i < plan.steps.length; i++) {
            const step = plan.steps[i];
            if (step.status === 'skipped')
                continue;
            if (signal.aborted) {
                this.state = 'interrupted';
                break;
            }
            const loopRecord = this.loopDetector.check(step);
            if (loopRecord) {
                this.state = 'failed';
                break;
            }
            const confirmed = await this.confirmationGate.requireConfirmation(step);
            if (!confirmed) {
                plan.steps[i] = { ...step, status: 'skipped' };
                continue;
            }
            plan.steps[i] = await this.stepExecutor.executeStep(step, executor);
            this.currentPlan = { ...plan, completedSteps: plan.steps.filter(s => s.status === 'completed').length };
        }
        if (this.state === 'executing')
            this.state = 'completed';
        return this.currentPlan;
    }
    interrupt() { this.executionInterrupter.interrupt(); }
    confirmStep(stepId) { this.confirmationGate.confirm(stepId); }
    rejectStep(stepId) { this.confirmationGate.reject(stepId); }
    getState() { return this.state; }
    getPlan() { return this.currentPlan; }
}
//# sourceMappingURL=agent-mode-enhancer.js.map