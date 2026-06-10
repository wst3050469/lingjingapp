import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../workflow/core/workflow-engine.js';
import { DAGOrchestrator } from '../fusion/dag-orchestrator/dag-orchestrator.js';
describe('WorkflowEngine', () => {
    let engine;
    beforeEach(() => {
        engine = new WorkflowEngine();
    });
    describe('constructor', () => {
        it('should create instance without arguments', () => {
            expect(engine).toBeInstanceOf(WorkflowEngine);
        });
    });
    describe('startWorkflow', () => {
        it('should create a workflow and return its id', async () => {
            const id = await engine.startWorkflow({ goal: 'test task' });
            expect(id).toContain('wf-');
        });
        it('should set status to running immediately after start', async () => {
            const id = engine.startWorkflow({ goal: 'test' });
            // startWorkflow is async because of the Promise-based ID return,
            // but the workflow transitions to RUNNING in executeWorkflow
            const wf = engine.getWorkflow(await id);
            expect(wf?.status).toBe('running');
        });
        it('should accept requirements with context and constraints', async () => {
            const id = await engine.startWorkflow({
                goal: 'complex task',
                context: { data: 'x' },
                constraints: ['timeout: 30s'],
                priority: 'high',
                model: 'gpt-4',
            });
            const wf = engine.getWorkflow(id);
            expect(wf?.requirement.goal).toBe('complex task');
            expect(wf?.requirement.priority).toBe('high');
        });
    });
    describe('onProgress', () => {
        it('should emit progress events during execution', async () => {
            const progressCb = vi.fn();
            const id = await engine.startWorkflow({ goal: 'test' });
            engine.onProgress(id, progressCb);
            await new Promise(r => setTimeout(r, 50));
            expect(progressCb).toHaveBeenCalled();
            const call = progressCb.mock.calls[0][0];
            expect(call.workflowId).toBe(id);
            expect(call.phase).toBeDefined();
        });
    });
    describe('getWorkflow', () => {
        it('should return undefined for non-existent workflow', () => {
            expect(engine.getWorkflow('nonexistent')).toBeUndefined();
        });
        it('should return workflow state for existing workflow', async () => {
            const id = await engine.startWorkflow({ goal: 'test' });
            const wf = engine.getWorkflow(id);
            expect(wf?.id).toBe(id);
            expect(wf?.createdAt).toBeGreaterThan(0);
        });
    });
    describe('listWorkflows', () => {
        it('should return empty initially', () => {
            expect(engine.listWorkflows()).toEqual([]);
        });
        it('should return all started workflows', async () => {
            await engine.startWorkflow({ goal: 'a' });
            await engine.startWorkflow({ goal: 'b' });
            expect(engine.listWorkflows()).toHaveLength(2);
        });
        it('should return in reverse chronological order', async () => {
            await engine.startWorkflow({ goal: 'first' });
            await new Promise(r => setTimeout(r, 5));
            await engine.startWorkflow({ goal: 'second' });
            const list = engine.listWorkflows();
            expect(list[0].requirement.goal).toBe('second');
            expect(list[1].requirement.goal).toBe('first');
        });
    });
    describe('pauseWorkflow', () => {
        it('should not throw when no running workflows', () => {
            expect(() => engine.pauseWorkflow()).not.toThrow();
        });
    });
    describe('resumeWorkflow', () => {
        it('should not throw when no paused workflows', () => {
            expect(() => engine.resumeWorkflow()).not.toThrow();
        });
    });
    describe('stopWorkflow', () => {
        it('should not throw when no running workflows', () => {
            expect(() => engine.stopWorkflow()).not.toThrow();
        });
    });
    describe('with slow orchestrator', () => {
        it('should pause/cancel workflows with slow execution', async () => {
            const slowExec = vi.fn().mockImplementation(async () => {
                await new Promise(r => setTimeout(r, 500));
                return 'slow result';
            });
            const dag = new DAGOrchestrator(slowExec);
            const slowEngine = new WorkflowEngine(dag);
            const id = await slowEngine.startWorkflow({ goal: 'slow task' });
            expect(slowEngine.getWorkflow(id)?.status).toBe('running');
            slowEngine.pauseWorkflow();
            expect(slowEngine.getWorkflow(id)?.status).toBe('paused');
            slowEngine.resumeWorkflow();
            expect(slowEngine.getWorkflow(id)?.status).toBe('running');
            slowEngine.stopWorkflow();
            expect(slowEngine.getWorkflow(id)?.status).toBe('cancelled');
        });
    });
});
//# sourceMappingURL=workflow-engine.test.js.map