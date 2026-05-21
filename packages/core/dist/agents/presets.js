// Agent presets registry
export const AGENT_PRESETS = {
    'code-reviewer': {
        name: 'code-reviewer',
        description: 'Reviews code for correctness, security, performance, and best practices. Read-only access.',
        systemPromptFile: 'code-reviewer.md',
        allowedTools: ['file_read', 'glob', 'grep', 'bash'],
        maxTurns: 20,
    },
    'explorer': {
        name: 'explorer',
        description: 'Explores codebases to find files, understand architecture, and answer questions. Read-only access.',
        systemPromptFile: 'explorer.md',
        allowedTools: ['file_read', 'glob', 'grep', 'bash'],
        maxTurns: 20,
    },
    'general': {
        name: 'general',
        description: 'General-purpose sub-agent with full tool access for executing multi-step tasks.',
        systemPromptFile: 'main.md',
        allowedTools: ['file_read', 'file_write', 'file_edit', 'bash', 'glob', 'grep', 'web_search', 'web_fetch'],
        maxTurns: 30,
    },
};
// Expert presets for Experts mode
export const EXPERT_PRESETS = {
    'frontend-expert': {
        name: 'frontend-expert',
        description: 'Frontend development expert specializing in React, CSS, accessibility, and component architecture.',
        systemPromptFile: 'frontend-expert.md',
        allowedTools: ['file_read', 'file_write', 'file_edit', 'bash', 'glob', 'grep', 'web_search', 'web_fetch'],
        maxTurns: 30,
        role: 'expert',
        emoji: '\u{1F3A8}',
    },
    'backend-expert': {
        name: 'backend-expert',
        description: 'Backend development expert specializing in APIs, databases, and service architecture.',
        systemPromptFile: 'backend-expert.md',
        allowedTools: ['file_read', 'file_write', 'file_edit', 'bash', 'glob', 'grep', 'web_search', 'web_fetch'],
        maxTurns: 30,
        role: 'expert',
        emoji: '\u{1F527}',
    },
    'qa-expert': {
        name: 'qa-expert',
        description: 'QA expert specializing in test cases, edge scenarios, and test frameworks.',
        systemPromptFile: 'qa-expert.md',
        allowedTools: ['file_read', 'file_write', 'file_edit', 'bash', 'glob', 'grep'],
        maxTurns: 25,
        role: 'expert',
        emoji: '\u{1F9EA}',
    },
    'code-review-expert': {
        name: 'code-review-expert',
        description: 'Code review expert focusing on code quality, security, and maintainability.',
        systemPromptFile: 'code-review-expert.md',
        allowedTools: ['file_read', 'glob', 'grep', 'bash'],
        maxTurns: 20,
        role: 'expert',
        emoji: '\u{1F50D}',
    },
    'research-expert': {
        name: 'research-expert',
        description: 'Research expert for technical evaluation, solution comparison, and documentation.',
        systemPromptFile: 'research-expert.md',
        allowedTools: ['file_read', 'glob', 'grep', 'web_search', 'web_fetch', 'bash'],
        maxTurns: 25,
        role: 'expert',
        emoji: '\u{1F4DA}',
    },
    'devops-expert': {
        name: 'devops-expert',
        description: 'DevOps expert specializing in CI/CD, deployment, monitoring, and infrastructure.',
        systemPromptFile: 'devops-expert.md',
        allowedTools: ['file_read', 'file_write', 'file_edit', 'bash', 'glob', 'grep'],
        maxTurns: 25,
        role: 'expert',
        emoji: '\u{1F680}',
    },
    'ux-design-expert': {
        name: 'ux-design-expert',
        description: 'UX design expert focusing on user experience, wireframes, and design systems.',
        systemPromptFile: 'ux-design-expert.md',
        allowedTools: ['file_read', 'file_write', 'file_edit', 'glob', 'grep', 'web_search', 'web_fetch'],
        maxTurns: 25,
        role: 'expert',
        emoji: '\u{1F3AF}',
    },
};
export function getPreset(name) {
    return AGENT_PRESETS[name];
}
export function getExpertPreset(name) {
    return EXPERT_PRESETS[name];
}
export function getExpertPresets() {
    return Object.values(EXPERT_PRESETS);
}
export function listPresets() {
    return Object.values(AGENT_PRESETS);
}
//# sourceMappingURL=presets.js.map