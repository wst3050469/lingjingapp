// Default configuration values
export const DEFAULT_CONFIG = {
    apiKeys: {},
    ollama: {
        baseUrl: 'http://localhost:11434',
    },
    custom: {
        name: '自定义 API',
        baseUrl: '',
        apiKey: '',
    },
    model: 'deepseek:deepseek-v4-pro',
    temperature: 0.3,
    maxResponseTokens: 4096,
    maxContextTokens: 128000,
    maxTurns: 500,
    maxDuration: 0,
    turnTimeout: 600000,
    autoMemory: true,
    thinkingMode: false,
    enableSkillHarvest: true,
    enableMemoryNudge: true,
    enableReflector: true,
    enableSandbox: false,
    language: 'auto',
    rules: '',
    tools: {
        disabled: [],
    },
    session: {
        autoExecute: false,
        blockedCommands: 'rm,mv,sudo,wget,curl,chown',
        mcpTools: true,
        retrievalTools: true,
        fileEditOutsideWorkspace: false,
    },
    wiki: {
        model: '',
        language: 'zh',
        maxFilesPerModule: 50,
        ignorePaths: [],
        concurrency: 3,
    },
    indexing: {
        concurrency: 5,
    },
    integrations: {
        browserAgent: {
            browserType: 'builtin',
            executionPolicy: 'ask',
            toolsAutoExecute: true,
        },
        planAgent: {
            executionPolicy: 'ask',
        },
        builtinBrowser: true,
    },
};
//# sourceMappingURL=defaults.js.map