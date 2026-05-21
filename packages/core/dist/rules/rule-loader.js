// Rule loader - loads rules from .qoder/rules/ directory and AGENTS.md
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
/**
 * Parse YAML-like frontmatter from markdown files
 * Supports simple key: value format
 */
function parseFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    if (!match) {
        return {
            metadata: {},
            body: content,
        };
    }
    const [, frontmatterStr, body] = match;
    const metadata = {};
    // Parse key: value pairs
    const lines = frontmatterStr.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const colonIdx = trimmed.indexOf(':');
        if (colonIdx === -1)
            continue;
        const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
        const value = trimmed.slice(colonIdx + 1).trim();
        switch (key) {
            case 'name':
                metadata.name = value;
                break;
            case 'type':
                metadata.type = value;
                break;
            case 'description':
                metadata.description = value;
                break;
            case 'filepatterns':
            case 'file_patterns':
            case 'patterns':
                metadata.filePatterns = value;
                break;
            case 'enabled':
                metadata.enabled = value.toLowerCase() === 'true';
                break;
        }
    }
    return { metadata, body: body.trim() };
}
/**
 * Load rules from .qoder/rules/ directory
 */
export function loadRulesFromDirectory(projectPath) {
    const rulesDir = join(projectPath, '.qoder', 'rules');
    const rules = [];
    if (!existsSync(rulesDir)) {
        return rules;
    }
    try {
        const files = readdirSync(rulesDir).filter(f => f.endsWith('.md'));
        for (const file of files) {
            const filePath = join(rulesDir, file);
            try {
                const content = readFileSync(filePath, 'utf-8');
                const { metadata, body } = parseFrontmatter(content);
                // Validate required fields
                if (!metadata.name || !metadata.type || !body) {
                    console.warn(`Skipping rule file ${file}: missing required fields`);
                    continue;
                }
                // Validate type
                const validTypes = ['manual', 'model', 'always', 'filePattern'];
                if (!validTypes.includes(metadata.type)) {
                    console.warn(`Skipping rule file ${file}: invalid type "${metadata.type}"`);
                    continue;
                }
                // filePattern type requires filePatterns
                if (metadata.type === 'filePattern' && !metadata.filePatterns) {
                    console.warn(`Skipping rule file ${file}: filePattern type requires filePatterns field`);
                    continue;
                }
                // model type requires description
                if (metadata.type === 'model' && !metadata.description) {
                    console.warn(`Skipping rule file ${file}: model type requires description field`);
                    continue;
                }
                rules.push({
                    id: `file-${file.replace('.md', '')}`,
                    name: metadata.name,
                    type: metadata.type,
                    content: body,
                    description: metadata.description,
                    filePatterns: metadata.filePatterns,
                    enabled: metadata.enabled !== false, // Default to true
                    source: 'file',
                    filePath,
                });
            }
            catch (error) {
                console.warn(`Failed to load rule file ${file}:`, error);
            }
        }
    }
    catch (error) {
        console.warn(`Failed to read rules directory:`, error);
    }
    return rules;
}
/**
 * Load AGENTS.md file from project root
 */
export function loadAgentsMd(projectPath) {
    const agentsPath = join(projectPath, 'AGENTS.md');
    if (!existsSync(agentsPath)) {
        return null;
    }
    try {
        const content = readFileSync(agentsPath, 'utf-8');
        return {
            id: 'agents-md',
            name: 'AGENTS.md',
            type: 'always',
            content: content.trim(),
            enabled: true,
            source: 'agents-md',
            filePath: agentsPath,
        };
    }
    catch (error) {
        console.warn(`Failed to load AGENTS.md:`, error);
        return null;
    }
}
/**
 * Load all rules from config and project directory
 */
export function loadAllRules(projectPath, configRules = []) {
    // Load rules from .qoder/rules/
    const fileRules = loadRulesFromDirectory(projectPath);
    // Load AGENTS.md
    const agentsMdRule = loadAgentsMd(projectPath);
    // Convert config rules to Rule type
    const configRulesTyped = configRules.map((rule, index) => ({
        id: rule.id || `config-${index}`,
        name: rule.name || `Rule ${index + 1}`,
        type: rule.type || 'always',
        content: rule.content || '',
        description: rule.description,
        filePatterns: rule.filePatterns,
        enabled: rule.enabled !== false,
        source: 'config',
    }));
    return {
        configRules: configRulesTyped,
        fileRules,
        agentsMdRule,
    };
}
/**
 * Apply rules based on their type and current file context
 * @param rules - All loaded rules
 * @param currentFile - Current file path (optional)
 * @returns Formatted rules text for system prompt
 */
export function applyRules(rules, currentFile) {
    const activeRules = rules.filter(r => r.enabled);
    if (activeRules.length === 0) {
        return '';
    }
    let rulesText = '\n\n## Active Rules\n\n';
    rulesText += '> **Priority**: When Rules and Memories conflict, Rules take precedence.\n\n';
    let ruleCount = 0;
    for (const rule of activeRules) {
        switch (rule.type) {
            case 'always':
                rulesText += `### ${rule.name}\n${rule.content}\n\n`;
                ruleCount++;
                break;
            case 'filePattern':
                if (currentFile && rule.filePatterns) {
                    // Import matchesPatterns dynamically to avoid circular dependency
                    const { matchesPatterns } = require('./pattern-matcher.js');
                    if (matchesPatterns(currentFile, rule.filePatterns)) {
                        rulesText += `### ${rule.name} (File: ${currentFile})\n${rule.content}\n\n`;
                        ruleCount++;
                    }
                }
                break;
            case 'model':
                // Model-decision rules are injected with description for AI to decide
                rulesText += `### ${rule.name} (Optional)\n`;
                rulesText += `**When to apply**: ${rule.description}\n`;
                rulesText += `**Rule**: ${rule.content}\n\n`;
                ruleCount++;
                break;
            case 'manual':
                // Manual rules are not automatically applied
                break;
        }
    }
    return ruleCount > 0 ? rulesText : '';
}
/**
 * Get manual rules for @rule selector
 */
export function getManualRules(rules) {
    return rules.filter(r => r.enabled && r.type === 'manual');
}
//# sourceMappingURL=rule-loader.js.map