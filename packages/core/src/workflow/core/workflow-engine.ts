import { DAGOrchestrator } from '../../fusion/dag-orchestrator/dag-orchestrator.js';
import type { DAGDefinition } from '../../fusion/dag-orchestrator/types.js';
import { logger } from '../../utils/logger.js';
import { WorkflowStatus } from '../types.js';
import type { WorkflowRequirement, WorkflowState, ProgressInfo } from '../types.js';

interface PendingWorkflow {
  state: WorkflowState;
  dag: DAGDefinition;
  abortController: AbortController | null;
}

export class WorkflowEngine {
  private orchestrator: DAGOrchestrator;
  private workflows = new Map<string, PendingWorkflow>();
  private listeners = new Map<string, Array<(progress: ProgressInfo) => void>>();

  constructor(orchestrator?: DAGOrchestrator) {
    this.orchestrator = orchestrator ?? new DAGOrchestrator(async (taskDef) => {
      return taskDef.prompt;
    });
  }

  onProgress(workflowId: string, callback: (progress: ProgressInfo) => void): void {
    const existing = this.listeners.get(workflowId) ?? [];
    existing.push(callback);
    this.listeners.set(workflowId, existing);
  }

  private emitProgress(workflowId: string, phase: string, progress: number, message: string): void {
    const callbacks = this.listeners.get(workflowId) ?? [];
    const info: ProgressInfo = { workflowId, phase, progress, message };
    for (const cb of callbacks) {
      try { cb(info); } catch { /* ignore listener errors */ }
    }
  }

  async startWorkflow(requirement: WorkflowRequirement): Promise<string> {
    const id = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dag = this.requirementToDAG(id, requirement);

    const state: WorkflowState = {
      id,
      requirement,
      status: WorkflowStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progress: 0,
    };

    const pending: PendingWorkflow = { state, dag, abortController: null };
    this.workflows.set(id, pending);

    // Execute asynchronously
    this.executeWorkflow(id).catch((err) => {
      logger.error(`[WorkflowEngine] Workflow ${id} execution error: ${err.message}`);
    });

    return id;
  }

  private async executeWorkflow(id: string): Promise<void> {
    const pending = this.workflows.get(id);
    if (!pending) return;

    pending.state.status = WorkflowStatus.RUNNING;
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
        pending.state.status = WorkflowStatus.COMPLETED;
        pending.state.progress = 100;
        pending.state.result = JSON.stringify(result);
        this.emitProgress(id, 'completed', 100, 'Workflow completed successfully');
      } else {
        pending.state.status = WorkflowStatus.FAILED;
        pending.state.progress = 50;
        pending.state.error = `Workflow ${result.status}: ${result.failedNodes.length} nodes failed`;
        this.emitProgress(id, 'failed', 50, pending.state.error);
      }
    } catch (err: any) {
      pending.state.status = WorkflowStatus.FAILED;
      pending.state.error = err.message;
      this.emitProgress(id, 'failed', 0, err.message);
    }

    pending.state.updatedAt = Date.now();
  }

  pauseWorkflow(): void {
    // Pause the most recently running workflow
    for (const [, pending] of this.workflows) {
      if (pending.state.status === WorkflowStatus.RUNNING) {
        pending.state.status = WorkflowStatus.PAUSED;
        pending.state.updatedAt = Date.now();
        this.emitProgress(pending.state.id, 'paused', pending.state.progress, 'Workflow paused');
        return;
      }
    }
  }

  resumeWorkflow(): void {
    // Resume the most recently paused workflow
    for (const [, pending] of this.workflows) {
      if (pending.state.status === WorkflowStatus.PAUSED) {
        pending.state.status = WorkflowStatus.RUNNING;
        pending.state.updatedAt = Date.now();
        this.emitProgress(pending.state.id, 'resumed', pending.state.progress, 'Workflow resumed');
        // Re-trigger execution
        this.executeWorkflow(pending.state.id).catch((err) => {
          logger.error(`[WorkflowEngine] Resume error: ${err.message}`);
        });
        return;
      }
    }
  }

  stopWorkflow(): void {
    // Stop all running workflows
    for (const [, pending] of this.workflows) {
      if (pending.state.status === WorkflowStatus.RUNNING || pending.state.status === WorkflowStatus.PAUSED) {
        pending.state.status = WorkflowStatus.CANCELLED;
        pending.state.updatedAt = Date.now();
        this.emitProgress(pending.state.id, 'cancelled', pending.state.progress, 'Workflow cancelled');
      }
    }
  }

  listWorkflows(): WorkflowState[] {
    return Array.from(this.workflows.values())
      .map((p) => p.state)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getWorkflow(id: string): WorkflowState | undefined {
    return this.workflows.get(id)?.state;
  }

  private requirementToDAG(workflowId: string, requirement: WorkflowRequirement): DAGDefinition {
    return {
      id: workflowId,
      nodes: [
        {
          taskId: 'main',
          taskDef: {
            name: requirement.goal.slice(0, 50),
            prompt: `Execute: ${requirement.goal}. Context: ${JSON.stringify(requirement.context ?? {})}`,
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
