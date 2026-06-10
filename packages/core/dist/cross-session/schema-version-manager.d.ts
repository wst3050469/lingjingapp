import type { VersionCompatibility } from './types.js';
import { MigrationPipeline } from './migration-pipeline.js';
export declare class SchemaVersionManager {
    readonly currentVersion = "2.0.0";
    private pipeline;
    constructor(pipeline: MigrationPipeline);
    detectVersion(snapshotVersion: string): VersionCompatibility;
    migrate(data: Record<string, unknown>, fromVersion: string, toVersion?: string): Promise<Record<string, unknown>>;
    stampVersion(data: Record<string, unknown>): Record<string, unknown>;
}
//# sourceMappingURL=schema-version-manager.d.ts.map