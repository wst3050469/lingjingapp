import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import fg from 'fast-glob';
import { SecurityRuleLoader } from './rule-loader.js';
const LANGUAGE_MAP = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    py: 'python', java: 'java', go: 'go', rs: 'rust',
};
export class SecurityScanner {
    ruleLoader;
    aborted = false;
    constructor() {
        this.ruleLoader = new SecurityRuleLoader();
    }
    async scan(projectPath, scope = 'full', specifiedFiles, onProgress) {
        const startTime = Date.now();
        this.aborted = false;
        await this.ruleLoader.loadRules(projectPath);
        const files = await this.resolveScanFiles(projectPath, scope, specifiedFiles);
        onProgress?.({ phase: 'scanning', current: 0, total: files.length });
        const allVulnerabilities = [];
        const batchSize = 1000;
        for (let i = 0; i < files.length; i += batchSize) {
            if (this.aborted)
                break;
            const batch = files.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(async (filePath, batchIdx) => {
                const vulns = await this.scanFile(filePath, projectPath);
                onProgress?.({
                    phase: 'scanning',
                    current: i + batchIdx + 1,
                    total: files.length,
                    filePath,
                });
                return vulns;
            }));
            for (const vulns of batchResults)
                allVulnerabilities.push(...vulns);
        }
        const durationMs = Date.now() - startTime;
        return {
            id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            scope,
            targetFiles: files,
            vulnerabilities: allVulnerabilities,
            summary: this.buildSummary(allVulnerabilities),
            durationMs,
            scannedAt: new Date().toISOString(),
            projectPath,
        };
    }
    async scanFile(filePath, projectPath) {
        const ext = filePath.split('.').pop() || '';
        const language = LANGUAGE_MAP[ext];
        if (!language)
            return [];
        try {
            const content = await readFile(filePath, 'utf-8');
            const rules = this.ruleLoader.getRulesForLanguage(language);
            const vulnerabilities = [];
            const lines = content.split('\n');
            for (const rule of rules) {
                if (rule.patternType !== 'regex')
                    continue;
                try {
                    const regex = new RegExp(rule.pattern, 'g');
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        let match;
                        const timeout = setTimeout(() => { throw new Error('Regex timeout'); }, 2000);
                        try {
                            regex.lastIndex = 0;
                            match = regex.exec(line);
                        }
                        finally {
                            clearTimeout(timeout);
                        }
                        if (match) {
                            vulnerabilities.push({
                                ruleId: rule.id,
                                ruleName: rule.name,
                                vulnerabilityType: rule.vulnerabilityType,
                                severity: rule.severity,
                                filePath,
                                line: i + 1,
                                column: match.index + 1,
                                message: rule.message,
                                suggestion: rule.suggestion,
                                codeSnippet: line.trim().substring(0, 200),
                            });
                        }
                    }
                }
                catch (err) {
                    console.error(`[Security] Rule ${rule.id} error on ${filePath}:`, err);
                }
            }
            return vulnerabilities;
        }
        catch {
            return [];
        }
    }
    async resolveScanFiles(projectPath, scope, specifiedFiles) {
        if (scope === 'specified' && specifiedFiles)
            return specifiedFiles;
        const patterns = ['**/*.{ts,tsx,js,jsx,py,java,go,rs}'];
        const ignore = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'];
        if (scope === 'incremental') {
            // For incremental, ideally use git diff; fallback to full scan
            try {
                const { execSync } = await import('node:child_process');
                const diffOutput = execSync('git diff --name-only HEAD~1', { cwd: projectPath, encoding: 'utf-8' });
                const changedFiles = diffOutput.trim().split('\n').filter(Boolean);
                return changedFiles.map(f => join(projectPath, f));
            }
            catch {
                // fallback to full
            }
        }
        return fg(patterns, { cwd: projectPath, ignore, absolute: true });
    }
    cancel() {
        this.aborted = true;
    }
    getRuleLoader() {
        return this.ruleLoader;
    }
    buildSummary(vulnerabilities) {
        const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        const byType = {};
        for (const v of vulnerabilities) {
            bySeverity[v.severity]++;
            byType[v.vulnerabilityType] = (byType[v.vulnerabilityType] || 0) + 1;
        }
        return { total: vulnerabilities.length, bySeverity, byType };
    }
}
function existsSync(path) {
    try {
        require('fs').existsSync(path);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=scanner.js.map