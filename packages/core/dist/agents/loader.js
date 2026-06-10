// Custom Agent Loader - Scan and parse AGENT.md files from filesystem
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
/**
 * Map user-friendly tool names to internal names.
 */
const TOOL_NAME_MAP = {
    'bash': 'bash',
    'edit': 'file_edit',
    'file_edit': 'file_edit',
    'write': 'file_write',
    'file_write': 'file_write',
    'read': 'file_read',
    'file_read': 'file_read',
    'glob': 'glob',
    'grep': 'grep',
    'web_fetch': 'web_fetch',
    'web_search': 'web_search',
    'todo': 'todo',
    'plan': 'plan',
    'ask_user': 'ask_user',
    'codebase_search': 'codebase_search',
    'get_problems': 'get_problems',
    'code_review': 'code_review',
};
/**
 * All available internal tool names.
 */
const ALL_TOOLS = [
    'bash', 'file_edit', 'file_write', 'file_read', 'glob', 'grep',
    'web_fetch', 'web_search', 'todo', 'plan', 'ask_user',
    'codebase_search', 'get_problems', 'code_review',
];
/**
 * Normalize tool names from user-friendly to internal names.
 */
function normalizeToolNames(tools) {
    if (!tools || tools.length === 0) {
        return [...ALL_TOOLS]; // Default to all tools if not specified
    }
    const normalized = new Set();
    for (const tool of tools) {
        const internalName = TOOL_NAME_MAP[tool.toLowerCase().trim()];
        if (internalName) {
            normalized.add(internalName);
        }
    }
    return Array.from(normalized);
}
/**
 * Parse AGENT.md content to extract frontmatter and system prompt.
 */
export function parseAgentMd(content, filePath, level) {
    let frontmatterStr = '';
    let systemPrompt = content;
    // Check for YAML frontmatter (--- delimiter)
    if (content.startsWith('---\n')) {
        const endDelimiterIndex = content.indexOf('\n---\n', 4);
        if (endDelimiterIndex !== -1) {
            frontmatterStr = content.slice(4, endDelimiterIndex);
            systemPrompt = content.slice(endDelimiterIndex + 5).trim();
        }
    }
    // Parse frontmatter using simple key-value parsing (no external YAML dependency)
    const parsedFrontmatter = {};
    if (frontmatterStr) {
        const lines = frontmatterStr.split('\n');
        let currentKey = '';
        let currentArray = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#'))
                continue;
            // Check for key: value pattern
            const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
            if (match) {
                // Save previous array if exists
                if (currentKey && currentArray.length > 0) {
                    parsedFrontmatter[currentKey] = currentArray;
                    currentArray = [];
                }
                currentKey = match[1];
                const value = match[2].trim();
                if (value) {
                    // Single value (could be a string or start of array)
                    if (value.startsWith('[') && value.endsWith(']')) {
                        // Inline array
                        parsedFrontmatter[currentKey] = value
                            .slice(1, -1)
                            .split(',')
                            .map(item => item.trim().replace(/^["']|["']$/g, ''));
                        currentKey = '';
                    }
                    else {
                        // Try to parse as number or boolean
                        if (/^\d+$/.test(value)) {
                            parsedFrontmatter[currentKey] = parseInt(value, 10);
                        }
                        else if (/^\d+\.\d+$/.test(value)) {
                            parsedFrontmatter[currentKey] = parseFloat(value);
                        }
                        else if (value === 'true') {
                            parsedFrontmatter[currentKey] = true;
                        }
                        else if (value === 'false') {
                            parsedFrontmatter[currentKey] = false;
                        }
                        else {
                            parsedFrontmatter[currentKey] = value.replace(/^["']|["']$/g, '');
                        }
                        currentKey = '';
                    }
                }
                else {
                    // Start of multiline array
                    currentArray = [];
                }
            }
            else if (currentKey && trimmed.startsWith('- ')) {
                // Array item
                currentArray.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
            }
            else if (currentKey) {
                // Continuation of previous value (unlikely but handle it)
                continue;
            }
        }
        // Save last array if exists
        if (currentKey && currentArray.length > 0) {
            parsedFrontmatter[currentKey] = currentArray;
        }
    }
    // Extract required fields
    const name = parsedFrontmatter.name || filePath.split('/').slice(-2, -1)[0] || 'unknown';
    const description = parsedFrontmatter.description || '';
    // Extract optional fields with defaults
    const tools = normalizeToolNames(parsedFrontmatter.tools || []);
    const skills = parsedFrontmatter.skills || [];
    const mcpServers = parsedFrontmatter.mcpServers || [];
    const maxTurns = parsedFrontmatter.maxTurns || 30;
    const temperature = parsedFrontmatter.temperature || 0.3;
    return {
        name,
        description,
        tools,
        skills,
        mcpServers,
        maxTurns,
        temperature,
        systemPrompt,
        level,
        path: filePath,
    };
}
/**
 * Scan a single agents directory and return configs.
 */
async function scanAgentsDir(dir, level) {
    const agents = new Map();
    if (!existsSync(dir)) {
        return agents;
    }
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const agentDir = join(dir, entry.name);
            const agentMdPath = join(agentDir, 'AGENT.md');
            if (!existsSync(agentMdPath))
                continue;
            try {
                const content = await readFile(agentMdPath, 'utf8');
                const config = parseAgentMd(content, agentMdPath, level);
                agents.set(config.name, config);
            }
            catch (err) {
                console.error(`Failed to parse AGENT.md at ${agentMdPath}:`, err);
            }
        }
    }
    catch (err) {
        console.error(`Failed to scan agents directory ${dir}:`, err);
    }
    return agents;
}
/**
 * Get user-level agents directory.
 */
function getUserAgentsDir() {
    return join(homedir(), '.lingjing', 'agents');
}
/**
 * Scan both user-level and project-level agents directories.
 * Project-level agents override user-level agents with the same name.
 */
export async function scanAgentsDirs(workspace) {
    // Start with user-level agents
    const allAgents = await scanAgentsDir(getUserAgentsDir(), 'user');
    // Scan project-level agents (these will override user-level)
    if (workspace) {
        const projectAgentsDir = join(workspace, '.lingjing', 'agents');
        const projectAgents = await scanAgentsDir(projectAgentsDir, 'project');
        // Merge, project-level overrides user-level
        for (const [name, config] of projectAgents) {
            allAgents.set(name, config);
        }
    }
    return allAgents;
}
/**
 * Load all custom agents from filesystem.
 * This is the main entry point for loading custom agents.
 */
export async function loadAllCustomAgents(workspace) {
    return scanAgentsDirs(workspace);
}
/**
 * Get a single custom agent by name.
 */
export async function getCustomAgent(workspace, name) {
    const allAgents = await loadAllCustomAgents(workspace);
    return allAgents.get(name);
}
//# sourceMappingURL=loader.js.map