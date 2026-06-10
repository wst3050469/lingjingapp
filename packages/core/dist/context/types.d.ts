export type ContextSource = 'file' | 'folder' | 'auto-collected' | 'manual' | 'git-diff';
export type ContextPriority = 'critical' | 'high' | 'medium' | 'low';
export interface ContextFile {
    path: string;
    content: string;
    source: ContextSource;
    priority: ContextPriority;
    tokenCount: number;
    lastAccessedAt: Date;
}
export interface ContextUsage {
    usedTokens: number;
    maxTokens: number;
    utilizationPercent: number;
    fileCount: number;
}
export interface ContextWindowConfig {
    maxTokens: number;
    compactThreshold: number;
    compactTarget: number;
}
export interface ContextCompactConfig {
    strategy: 'truncate-low-priority' | 'summarize' | 'hybrid';
    targetUtilization: number;
}
export interface ContextInfo {
    files: ContextFile[];
    usage: ContextUsage;
    config: ContextWindowConfig;
}
//# sourceMappingURL=types.d.ts.map