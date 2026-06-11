import type { LLMProvider } from '../fusion/adapters/types.js';
import type { ToolResult } from './message-types.js';
import { Conversation } from './conversation.js';
import { ToolRegistry } from '../tools/registry.js';
import type { CodeReviewReport } from '../tools/builtin/code-review.js';
import { WorkflowEngine } from '../workflow/core/workflow-engine.js';
export type AgentEvent = {
    type: 'thinking';
} | {
    type: 'text';
    text: string;
} | {
    type: 'tool_start';
    name: string;
    args: Record<string, unknown>;
} | {
    type: 'tool_progress';
    name: string;
    text: string;
} | {
    type: 'tool_end';
    name: string;
    result: ToolResult;
} | {
    type: 'error';
    error: Error;
} | {
    type: 'usage';
    inputTokens: number;
    outputTokens: number;
} | {
    type: 'intervention_injected';
    text: string;
} | {
    type: 'code_review_report';
    report: CodeReviewReport;
} | {
    type: 'heartbeat';
    turn: number;
    elapsedMs: number;
} | {
    type: 'workflow_started';
    workflowId: string;
    featureName: string;
} | {
    type: 'workflow_progress';
    workflowId: string;
    phase: number;
    status: string;
} | {
    type: 'done';
};
export interface AgentConfig {
    provider: LLMProvider;
    tools: ToolRegistry;
    systemPrompt: string;
    maxTurns?: number;
    /** Wall-clock timeout for the entire agent run (ms). Default: 0 (no limit). */
    maxDuration?: number;
    /** Per-turn LLM call + tool execution timeout (ms). Default: 10 min. */
    turnTimeout?: number;
    maxContextTokens?: number;
    maxResponseTokens?: number;
    temperature?: number;
    workingDirectory: string;
    onEvent?: (event: AgentEvent) => void;
    askUser?: (question: string) => Promise<string>;
    sshTerminalId?: string;
    enableSkillHarvest?: boolean;
    enableMemoryNudge?: boolean;
    enableReflector?: boolean;
    enableSandbox?: boolean;
    /** 工作流引擎实例（可选） */
    workflowEngine?: WorkflowEngine;
}
export declare class Agent {
    /** @internal - public for cross-window hydration via IPC */
    conversation: Conversation;
    private executor;
    private config;
    private interventionQueue;
    private harvester;
    private nudger;
    private reflector;
    private runStartedAt;
    private workflowEngine;
    constructor(config: AgentConfig);
    /**
     * Inject a user intervention message into the agent loop.
     * The message will be picked up after the current tool execution batch completes.
     */
    injectIntervention(text: string): void;
    private emit;
    /**
     * Run one complete interaction: take user input, loop through LLM + tools until done.
     * Returns the final text response.
     */
    run(userMessage: string, signal?: AbortSignal, images?: Array<{
        data: string;
        mediaType: string;
    }>): Promise<string>;
    /**
     * Auto-compact the conversation by summarizing old messages using the LLM.
     * Keeps recent messages intact and replaces older ones with a summary.
     */
    private autoCompact;
    /**
     * Merge two AbortSignals into one — aborts when either fires.
     * Uses AbortSignal.any() on Node >=20, falls back to manual wiring.
     */
    private mergeSignals;
    private mergeSignalsManual;
    getConversation(): Conversation;
}
//# sourceMappingURL=agent.d.ts.map