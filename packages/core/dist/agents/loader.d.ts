import type { CustomAgentConfig } from './types.js';
/**
 * Parse AGENT.md content to extract frontmatter and system prompt.
 */
export declare function parseAgentMd(content: string, filePath: string, level: 'user' | 'project'): CustomAgentConfig;
/**
 * Scan both user-level and project-level agents directories.
 * Project-level agents override user-level agents with the same name.
 */
export declare function scanAgentsDirs(workspace: string): Promise<Map<string, CustomAgentConfig>>;
/**
 * Load all custom agents from filesystem.
 * This is the main entry point for loading custom agents.
 */
export declare function loadAllCustomAgents(workspace: string): Promise<Map<string, CustomAgentConfig>>;
/**
 * Get a single custom agent by name.
 */
export declare function getCustomAgent(workspace: string, name: string): Promise<CustomAgentConfig | undefined>;
//# sourceMappingURL=loader.d.ts.map