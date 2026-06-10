import { TokenCalculator } from './token-calculator.js';
import { AutoCollector } from './auto-collector.js';
import { Compactor } from './compactor.js';
export class ContextManager {
    config;
    files = [];
    tokenCalculator;
    autoCollector;
    compactor;
    constructor(config) {
        this.config = config;
        this.tokenCalculator = new TokenCalculator();
        this.autoCollector = new AutoCollector();
        this.compactor = new Compactor();
    }
    autoCollect(projectRoot, openFiles, recentEdits) {
        const collected = this.autoCollector.collect({ projectRoot, openFiles, recentEdits });
        for (const file of collected) {
            if (!this.files.some(f => f.path === file.path)) {
                this.files.push(file);
            }
        }
    }
    addFile(path, content, priority = 'medium') {
        const tokenCount = this.tokenCalculator.estimateTokens(content);
        if (!this.files.some(f => f.path === path)) {
            this.files.push({
                path,
                content,
                source: 'manual',
                priority,
                tokenCount,
                lastAccessedAt: new Date(),
            });
        }
    }
    removeFile(path) {
        this.files = this.files.filter(f => f.path !== path);
    }
    addFolder(paths, contents) {
        for (const path of paths) {
            const content = contents.get(path);
            if (content) {
                this.addFile(path, content, 'low');
            }
        }
    }
    getUsage() {
        const usedTokens = this.files.reduce((sum, f) => sum + f.tokenCount, 0);
        return {
            usedTokens,
            maxTokens: this.config.maxTokens,
            utilizationPercent: Math.round((usedTokens / this.config.maxTokens) * 100),
            fileCount: this.files.length,
        };
    }
    compact(config) {
        const compactConfig = config ?? {
            strategy: 'truncate-low-priority',
            targetUtilization: 50,
        };
        const usage = this.getUsage();
        this.files = this.compactor.compact(this.files, usage, compactConfig);
    }
    getInfo() {
        return {
            files: this.files,
            usage: this.getUsage(),
            config: this.config,
        };
    }
    getFiles() {
        return [...this.files];
    }
}
//# sourceMappingURL=context-manager.js.map