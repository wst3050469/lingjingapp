export class StepExecutor {
    onProgress = null;
    setProgressHandler(handler) {
        this.onProgress = handler;
    }
    async executeStep(step, executor) {
        const startedStep = { ...step, status: 'running', startedAt: new Date() };
        this.onProgress?.({ stepId: step.id, status: 'running' });
        try {
            const output = await executor(step.toolName, step.toolArgs);
            const completedStep = { ...startedStep, status: 'completed', output, completedAt: new Date() };
            this.onProgress?.({ stepId: step.id, status: 'completed', output });
            return completedStep;
        }
        catch (error) {
            const failedStep = { ...startedStep, status: 'failed', output: String(error), completedAt: new Date() };
            this.onProgress?.({ stepId: step.id, status: 'failed', output: String(error) });
            return failedStep;
        }
    }
}
//# sourceMappingURL=step-executor.js.map