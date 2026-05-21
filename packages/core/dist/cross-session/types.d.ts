import type { Message } from '../agent/message-types.js';
export type RestoreStrategy = 'full' | 'summary' | 'selective';
export type SnapshotStatus = 'active' | 'completed' | 'interrupted' | 'corrupted';
export type StorageBackendType = 'sqlite' | 'filesystem' | 'memory';
export interface ModelConfigSnapshot {
    provider: string;
    model: string;
    temperature: number;
    maxContextTokens: number;
    maxResponseTokens: number;
}
export interface PlanStateSnapshot {
    planId: string;
    currentStep: number;
    totalSteps: number;
    steps: Array<{
        id: string;
        title: string;
        status: string;
    }>;
}
export interface ToolCallRecord {
    toolName: string;
    arguments: Record<string, unknown>;
    resultSummary: string;
    isError: boolean;
    durationMs: number;
    timestamp: number;
}
export interface ReflectorResultSnapshot {
    insights: string[];
    patterns: string[];
    preferences: string[];
    generatedAt: number;
}
export interface ContextLayers {
    system: Message[];
    working: Message[];
    history: Message[];
}
export interface ContextSnapshot {
    snapshotId: string;
    snapshotVersion: string;
    sessionId: string;
    parentSessionId?: string;
    createdAt: number;
    workingDirectory: string;
    modelConfig: ModelConfigSnapshot;
    status: SnapshotStatus;
    layers: ContextLayers;
    compactionSummary?: string;
    taskState?: PlanStateSnapshot;
    toolCallHistory: ToolCallRecord[];
    checkpointRefs: string[];
    memoryRefs: string[];
    reflectorResult?: ReflectorResultSnapshot;
    metadata: Record<string, unknown>;
    checksum: string;
}
export interface IncrementalSnapshot {
    incrementalId: string;
    baseSnapshotId: string;
    deltas: {
        addedMessages?: Message[];
        modifiedTaskState?: PlanStateSnapshot;
        addedToolCalls?: ToolCallRecord[];
        removedMessageIds?: string[];
    };
    createdAt: number;
    checksum: string;
}
export interface SessionMetadata {
    sessionId: string;
    snapshotId: string;
    createdAt: number;
    status: SnapshotStatus;
    workingDirectory: string;
    modelProvider: string;
    messageCount: number;
    lastActivityAt: number;
}
export interface SessionMetadataIndex {
    sessions: SessionMetadata[];
    updatedAt: number;
}
export interface PersistResult {
    success: boolean;
    snapshotId: string;
    sizeBytes: number;
    durationMs: number;
    error?: string;
}
export interface RestoreOptions {
    maxContextTokens?: number;
    categories?: string[];
    workingWindowSize?: number;
}
export interface RestoredContext {
    sessionId: string;
    messages: Message[];
    taskState?: PlanStateSnapshot;
    toolCallHistory: ToolCallRecord[];
    compactionSummary?: string;
    wasMigrated: boolean;
    originalVersion?: string;
    warnings: string[];
}
export interface ResolvedSnapshot extends ContextSnapshot {
    resolvedCheckpoints?: Array<{
        ref: string;
        data: unknown;
    }>;
    resolvedMemories?: Array<{
        ref: string;
        content: string;
    }>;
    missingRefs: string[];
}
export interface VersionCompatibility {
    isCompatible: boolean;
    requiresMigration: boolean;
    fromVersion: string;
    toVersion: string;
}
export interface MigrationStep {
    fromVersion: string;
    toVersion: string;
    transform: (data: Record<string, unknown>) => Record<string, unknown>;
    rollback?: (data: Record<string, unknown>) => Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map