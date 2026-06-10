import { readFile, readdir, watch } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import YAML from 'yaml';
import { BUILTIN_SECURITY_RULES } from './builtin-rules.js';
export class SecurityRuleLoader {
    rules = [];
    watchers = [];
    async loadRules(projectPath) {
        this.rules = [...BUILTIN_SECURITY_RULES];
        await this.loadCustomRules(projectPath);
        return this.rules.filter(r => r.enabled !== false);
    }
    async loadCustomRules(projectPath) {
        const customDir = join(projectPath, '.lingjing', 'security-rules');
        if (!existsSync(customDir))
            return;
        try {
            const files = await readdir(customDir);
            for (const file of files) {
                if (!file.endsWith('.yaml') && !file.endsWith('.yml'))
                    continue;
                try {
                    const content = await readFile(join(customDir, file), 'utf-8');
                    const parsed = YAML.parse(content);
                    const ruleArray = Array.isArray(parsed) ? parsed : [parsed];
                    for (const rule of ruleArray) {
                        if (!rule.id || !rule.name || !rule.pattern)
                            continue;
                        try {
                            new RegExp(rule.pattern);
                        }
                        catch {
                            console.warn(`[Security] Skipping rule ${rule.id}: invalid regex`);
                            continue;
                        }
                        this.rules.push({
                            ...rule,
                            patternType: rule.patternType || 'regex',
                            severity: rule.severity || 'high',
                            languages: rule.languages || [],
                            enabled: rule.enabled !== false,
                            builtin: false,
                        });
                    }
                }
                catch (err) {
                    console.error(`[Security] Failed to load rule file ${file}:`, err);
                }
            }
        }
        catch (err) {
            console.error('[Security] Failed to read custom rules directory:', err);
        }
    }
    startFileWatcher(projectPath) {
        const customDir = join(projectPath, '.lingjing', 'security-rules');
        if (!existsSync(customDir))
            return;
        const controller = new AbortController();
        this.watchers.push(controller);
        try {
            const fsWatcher = watch(customDir, { signal: controller.signal });
            (async () => {
                for await (const _event of fsWatcher) {
                    await this.loadRules(projectPath);
                }
            })().catch(() => { });
        }
        catch {
            // ignore
        }
    }
    getRulesForLanguage(language) {
        return this.rules.filter(r => r.enabled !== false && (r.languages.length === 0 || r.languages.includes(language)));
    }
    getRules() {
        return [...this.rules];
    }
    dispose() {
        for (const controller of this.watchers)
            controller.abort();
        this.watchers = [];
    }
}
//# sourceMappingURL=rule-loader.js.map