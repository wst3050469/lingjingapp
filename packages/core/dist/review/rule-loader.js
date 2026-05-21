import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import YAML from 'yaml';
import { BUILTIN_REVIEW_RULES } from './dimension-rules.js';
export class ReviewRuleLoader {
    rules = [];
    async loadRules(projectPath) {
        this.rules = [...BUILTIN_REVIEW_RULES];
        const customDir = join(projectPath, '.lingjing', 'review-rules');
        if (existsSync(customDir)) {
            try {
                const files = await readdir(customDir);
                for (const file of files) {
                    if (!file.endsWith('.yaml') && !file.endsWith('.yml'))
                        continue;
                    try {
                        const content = await readFile(join(customDir, file), 'utf-8');
                        const parsed = YAML.parse(content);
                        if (Array.isArray(parsed)) {
                            for (const rule of parsed)
                                this.addRule(rule);
                        }
                        else if (parsed) {
                            this.addRule(parsed);
                        }
                    }
                    catch (err) {
                        console.error(`[Review] Failed to load custom rule ${file}:`, err);
                    }
                }
            }
            catch (err) {
                console.error('[Review] Failed to read custom rules directory:', err);
            }
        }
        return this.rules.filter(r => r.enabled !== false);
    }
    addRule(rule) {
        if (!rule.id || !rule.name || !rule.pattern) {
            console.warn('[Review] Skipping invalid rule: missing id/name/pattern');
            return;
        }
        try {
            new RegExp(rule.pattern);
        }
        catch {
            console.warn(`[Review] Skipping rule ${rule.id}: invalid regex pattern`);
            return;
        }
        this.rules.push({
            ...rule,
            dimension: rule.dimension || 'style',
            severity: rule.severity || 'warning',
            patternType: rule.patternType || 'regex',
            languages: rule.languages || [],
            enabled: rule.enabled !== false,
            builtin: false,
        });
    }
    match(diffContent, filePath, language) {
        const findings = [];
        const lines = diffContent.split('\n');
        const enabledRules = this.rules.filter(r => r.enabled !== false && (r.languages.length === 0 || r.languages.includes(language)));
        for (const rule of enabledRules) {
            if (rule.patternType !== 'regex')
                continue;
            try {
                const regex = new RegExp(rule.pattern, 'g');
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.startsWith('+') || line.startsWith('+++'))
                        continue;
                    const codeLine = line.substring(1);
                    let match;
                    const timeout = setTimeout(() => { throw new Error(`Regex timeout for rule ${rule.id}`); }, 2000);
                    try {
                        regex.lastIndex = 0;
                        match = regex.exec(codeLine);
                    }
                    finally {
                        clearTimeout(timeout);
                    }
                    if (match) {
                        findings.push({
                            ruleId: rule.id,
                            ruleName: rule.name,
                            dimension: rule.dimension,
                            severity: rule.severity,
                            filePath,
                            line: i + 1,
                            column: match.index + 1,
                            message: rule.message,
                            suggestion: rule.suggestion,
                            codeSnippet: codeLine.trim(),
                        });
                    }
                }
            }
            catch (err) {
                console.error(`[Review] Rule ${rule.id} execution error:`, err);
            }
        }
        return findings;
    }
    getRules() {
        return [...this.rules];
    }
}
//# sourceMappingURL=rule-loader.js.map