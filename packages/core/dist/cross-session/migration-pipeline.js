import { StructuredError } from '../errors/index.js';
export class MigrationPipeline {
    steps = new Map();
    register(step) {
        const key = `${step.fromVersion}->${step.toVersion}`;
        this.steps.set(key, step);
    }
    async execute(data, fromVersion, toVersion) {
        let current = structuredClone(data);
        let version = fromVersion;
        while (version !== toVersion) {
            const key = `${version}->${toVersion}`;
            const directStep = this.steps.get(key);
            if (directStep) {
                try {
                    current = directStep.transform(current);
                    version = toVersion;
                    continue;
                }
                catch (error) {
                    if (directStep.rollback) {
                        try {
                            current = directStep.rollback(current);
                        }
                        catch {
                            // rollback failed, use original
                        }
                    }
                    throw new StructuredError(`Migration failed: ${version}->${toVersion}`, {
                        recoverable: false,
                    });
                }
            }
            let foundNext = false;
            for (const [stepKey, step] of this.steps) {
                if (step.fromVersion === version) {
                    try {
                        current = step.transform(current);
                        version = step.toVersion;
                        foundNext = true;
                        break;
                    }
                    catch (error) {
                        if (step.rollback) {
                            try {
                                current = step.rollback(current);
                            }
                            catch {
                                // rollback failed
                            }
                        }
                        throw new StructuredError(`Migration step failed: ${stepKey}`, {
                            recoverable: false,
                        });
                    }
                }
            }
            if (!foundNext) {
                if (version !== fromVersion) {
                    current._metadata = {
                        ...current._metadata,
                        legacy: { ...current._metadata?.legacy, [fromVersion]: data },
                    };
                }
                throw new StructuredError(`No migration path from ${version} to ${toVersion}`, {
                    recoverable: false,
                });
            }
        }
        return current;
    }
    getRegisteredSteps() {
        return Array.from(this.steps.keys());
    }
    hasStep(fromVersion, toVersion) {
        return this.steps.has(`${fromVersion}->${toVersion}`);
    }
}
//# sourceMappingURL=migration-pipeline.js.map