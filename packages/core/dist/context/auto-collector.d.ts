import type { ContextFile } from './types.js';
interface AutoCollectorConfig {
    projectRoot: string;
    openFiles: string[];
    recentEdits: string[];
}
export declare class AutoCollector {
    collect(config: AutoCollectorConfig): ContextFile[];
    private readFileContent;
}
export {};
//# sourceMappingURL=auto-collector.d.ts.map