export class SchemaVersionManager {
    currentVersion = '2.0.0';
    pipeline;
    constructor(pipeline) {
        this.pipeline = pipeline;
    }
    detectVersion(snapshotVersion) {
        const isCompatible = snapshotVersion === this.currentVersion;
        const requiresMigration = !isCompatible;
        return {
            isCompatible,
            requiresMigration,
            fromVersion: snapshotVersion,
            toVersion: this.currentVersion,
        };
    }
    async migrate(data, fromVersion, toVersion) {
        const target = toVersion ?? this.currentVersion;
        if (fromVersion === target) {
            return data;
        }
        return this.pipeline.execute(data, fromVersion, target);
    }
    stampVersion(data) {
        return {
            ...data,
            snapshotVersion: this.currentVersion,
        };
    }
}
//# sourceMappingURL=schema-version-manager.js.map