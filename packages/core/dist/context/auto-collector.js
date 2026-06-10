import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
export class AutoCollector {
    collect(config) {
        const files = [];
        for (const filePath of config.openFiles) {
            const content = this.readFileContent(filePath);
            if (content !== null) {
                files.push({
                    path: filePath,
                    content,
                    source: 'auto-collected',
                    priority: 'critical',
                    tokenCount: Math.ceil(content.length / 4),
                    lastAccessedAt: new Date(),
                });
            }
        }
        const configFiles = ['package.json', 'tsconfig.json', '.eslintrc.json', '.prettierrc'];
        for (const cfg of configFiles) {
            const cfgPath = join(config.projectRoot, cfg);
            const content = this.readFileContent(cfgPath);
            if (content !== null) {
                files.push({
                    path: cfgPath,
                    content,
                    source: 'auto-collected',
                    priority: 'medium',
                    tokenCount: Math.ceil(content.length / 4),
                    lastAccessedAt: new Date(),
                });
            }
        }
        for (const filePath of config.recentEdits) {
            if (!files.some(f => f.path === filePath)) {
                const content = this.readFileContent(filePath);
                if (content !== null) {
                    files.push({
                        path: filePath,
                        content,
                        source: 'auto-collected',
                        priority: 'high',
                        tokenCount: Math.ceil(content.length / 4),
                        lastAccessedAt: new Date(),
                    });
                }
            }
        }
        return files;
    }
    readFileContent(filePath) {
        try {
            if (existsSync(filePath)) {
                return readFileSync(filePath, 'utf-8');
            }
        }
        catch { }
        return null;
    }
}
//# sourceMappingURL=auto-collector.js.map