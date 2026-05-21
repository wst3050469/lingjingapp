export interface AgentPreset {
    name: string;
    description: string;
    systemPromptFile: string;
    allowedTools: string[];
    maxTurns: number;
    role?: 'expert' | 'sub-agent';
    emoji?: string;
}
/**
 * Custom Agent configuration loaded from AGENT.md files.
 * Supports user-defined agents with custom tool permissions, skills, and MCP servers.
 */
export interface CustomAgentConfig {
    name: string;
    description: string;
    tools: string[];
    skills: string[];
    mcpServers: string[];
    maxTurns: number;
    temperature: number;
    systemPrompt: string;
    level: 'user' | 'project';
    path: string;
}
//# sourceMappingURL=types.d.ts.map