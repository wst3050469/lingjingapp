import type { MigrationStep } from './types.js';
export declare class MigrationPipeline {
    private steps;
    register(step: MigrationStep): void;
    execute(data: Record<string, unknown>, fromVersion: string, toVersion: string): Promise<Record<string, unknown>>;
    getRegisteredSteps(): string[];
    hasStep(fromVersion: string, toVersion: string): boolean;
}
//# sourceMappingURL=migration-pipeline.d.ts.map