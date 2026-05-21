import type { ContextFile, ContextInfo, ContextUsage, ContextWindowConfig, ContextCompactConfig, ContextPriority } from './types.js';
export declare class ContextManager {
    private config;
    private files;
    private tokenCalculator;
    private autoCollector;
    private compactor;
    constructor(config: ContextWindowConfig);
    autoCollect(projectRoot: string, openFiles: string[], recentEdits: string[]): void;
    addFile(path: string, content: string, priority?: ContextPriority): void;
    removeFile(path: string): void;
    addFolder(paths: string[], contents: Map<string, string>): void;
    getUsage(): ContextUsage;
    compact(config?: ContextCompactConfig): void;
    getInfo(): ContextInfo;
    getFiles(): ContextFile[];
}
//# sourceMappingURL=context-manager.d.ts.map