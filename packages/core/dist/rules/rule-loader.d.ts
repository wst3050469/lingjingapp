import type { Rule, LoadedRules } from './types.js';
/**
 * Load rules from .qoder/rules/ directory
 */
export declare function loadRulesFromDirectory(projectPath: string): Rule[];
/**
 * Load AGENTS.md file from project root
 */
export declare function loadAgentsMd(projectPath: string): Rule | null;
/**
 * Load all rules from config and project directory
 */
export declare function loadAllRules(projectPath: string, configRules?: Array<Record<string, unknown>>): LoadedRules;
/**
 * Apply rules based on their type and current file context
 * @param rules - All loaded rules
 * @param currentFile - Current file path (optional)
 * @returns Formatted rules text for system prompt
 */
export declare function applyRules(rules: Rule[], currentFile?: string): string;
/**
 * Get manual rules for @rule selector
 */
export declare function getManualRules(rules: Rule[]): Rule[];
//# sourceMappingURL=rule-loader.d.ts.map