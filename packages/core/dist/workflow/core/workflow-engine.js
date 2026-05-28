"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngine = void 0;
const dag_orchestrator_js_1 = require("../../fusion/dag-orchestrator/dag-orchestrator.js");
const logger_js_1 = require("../../utils/logger.js");
const types_js_1 = require("../types.js");
class WorkflowEngine {
    orchestrator;
    workflows = new Map();
    listeners = new Map();
    constructor(orchestrator) {
        this.orchestrator = orchestrator ?? new dag_orchestrator_js_1.DAGOrchestrator(async (taskDef) => {
            return taskDef.prompt;
        });
    }
    onProgress(workflowId, callback) {
        const existing = this.listeners.get(workflowId) ?? [];
        existing.push(callback);
        this.listeners.set(workflowId, existing);
    }
    emitProgress(workflowId, phase, progress, message) {
        const callbacks = this.listeners.get(workflowId) ?? [];
        const info = { workflowId, phase, progress, message };
        for (const cb of callbacks) {
            try {
                cb(info);
            }
            catch { /* ignore listener errors */ }
        }
    }
    async startWorkflow(requirement) {
        const id = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const dag = this.requirementToDAG(id, requirement);
        const state = {
            id,
            requirement,
            status: types_js_1.WorkflowStatus.PENDING,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            progress: 0,
        };
        const pending = { state, dag, abortController: null };
        this.workflows.set(id, pending);
        // Execute asynchronously
        this.executeWorkflow(id).catch((err) => {
            logger_js_1.logger.error(`[WorkflowEngine] Workflow ${id} execution error: ${err.message}`);
        });
        return id;
    }
    async executeWorkflow(id) {
        const pending = this.workflows.get(id);
        if (!pending)
            return;
        pending.state.status = types_js_1.WorkflowStatus.RUNNING;
        pending.state.updatedAt = Date.now();
        this.emitProgress(id, 'initializing', 0, 'Workflow started');
        try {
            const context = {
                goal: pending.state.requirement.goal,
                ...pending.state.requirement.context,
            };
            this.emitProgress(id, 'validating', 10, 'Validating workflow plan');
            const validation = this.orchestrator.validateDAG(pending.dag);
            if (!validation.valid) {
                throw new Error(`Invalid DAG: ${validation.error}`);
            }
            this.emitProgress(id, 'executing', 20, 'Executing workflow steps');
            const result = await this.orchestrator.execute(pending.dag, context);
            if (result.status === 'completed') {
                pending.state.status = types_js_1.WorkflowStatus.COMPLETED;
                pending.state.progress = 100;
                pending.state.result = JSON.stringify(result);
                this.emitProgress(id, 'completed', 100, 'Workflow completed successfully');
            }
            else {
                pending.state.status = types_js_1.WorkflowStatus.FAILED;
                pending.state.progress = 50;
                pending.state.error = `Workflow ${result.status}: ${result.failedNodes.length} nodes failed`;
                this.emitProgress(id, 'failed', 50, pending.state.error);
            }
        }
        catch (err) {
            pending.state.status = types_js_1.WorkflowStatus.FAILED;
            pending.state.error = err.message;
            this.emitProgress(id, 'failed', 0, err.message);
        }
        pending.state.updatedAt = Date.now();
    }
    pauseWorkflow() {
        // Pause the most recently running workflow
        for (const [, pending] of this.workflows) {
            if (pending.state.status === types_js_1.WorkflowStatus.RUNNING) {
                pending.state.status = types_js_1.WorkflowStatus.PAUSED;
                pending.state.updatedAt = Date.now();
                this.emitProgress(pending.state.id, 'paused', pending.state.progress, 'Workflow paused');
                return;
            }
        }
    }
    resumeWorkflow() {
        // Resume the most recently paused workflow
        for (const [, pending] of this.workflows) {
            if (pending.state.status === types_js_1.WorkflowStatus.PAUSED) {
                pending.state.status = types_js_1.WorkflowStatus.RUNNING;
                pending.state.updatedAt = Date.now();
                this.emitProgress(pending.state.id, 'resumed', pending.state.progress, 'Workflow resumed');
                // Re-trigger execution
                this.executeWorkflow(pending.state.id).catch((err) => {
                    logger_js_1.logger.error(`[WorkflowEngine] Resume error: ${err.message}`);
                });
                return;
            }
        }
    }
    stopWorkflow() {
        // Stop all running workflows
        for (const [, pending] of this.workflows) {
            if (pending.state.status === types_js_1.WorkflowStatus.RUNNING || pending.state.status === types_js_1.WorkflowStatus.PAUSED) {
                pending.state.status = types_js_1.WorkflowStatus.CANCELLED;
                pending.state.updatedAt = Date.now();
                this.emitProgress(pending.state.id, 'cancelled', pending.state.progress, 'Workflow cancelled');
            }
        }
    }
    listWorkflows() {
        return Array.from(this.workflows.values())
            .map((p) => p.state)
            .sort((a, b) => b.createdAt - a.createdAt);
    }
    getWorkflow(id) {
        return this.workflows.get(id)?.state;
    }
    requirementToDAG(workflowId, requirement) {
        return {
            id: workflowId,
            nodes: [
                {
                    taskId: 'main',
                    taskDef: {
                        name: (requirement.goal || '').slice(0, 50),
                        prompt: `Execute: ${requirement.goal || ''}. Context: ${JSON.stringify(requirement.context ?? {})}`,
                        model: requirement.model,
                    },
                    dependencies: [],
                },
            ],
            edges: [],
            maxConcurrency: 1,
        };
    }
}
exports.WorkflowEngine = WorkflowEngine;
//# sourceMappingURL=workflow-engine.js.map