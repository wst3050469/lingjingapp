// Configuration schema using Zod
import { z } from 'zod';
// Rule type enum
const RuleTypeSchema = z.enum(['manual', 'model', 'always', 'filePattern']);
// Individual rule schema
const RuleSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: RuleTypeSchema,
    content: z.string(),
    description: z.string().optional(),
    filePatterns: z.string().optional(),
    enabled: z.boolean().default(true),
});
export const AppConfigSchema = z.object({
    apiKeys: z.object({
        openai: z.string().optional(),
        anthropic: z.string().optional(),
        deepseek: z.string().optional(),
        baidu: z.string().optional(),
        tencent: z.string().optional(),
        kimi: z.string().optional(),
        qwen: z.string().optional(),
        doubao: z.string().optional(),
        glm: z.string().optional(),
        minimax: z.string().optional(),
        jinmo: z.string().optional(),
        gemma: z.string().optional(),
        qwen35b: z.string().optional(),
    }).default({}),
    ollama: z.object({
        baseUrl: z.string().default('http://localhost:11434'),
    }).default({}),
    custom: z.object({
        name: z.string().default('自定义 API'),
        baseUrl: z.string().default(''),
        apiKey: z.string().default(''),
    }).default({}),
    model: z.string().default('ollama:gemma4:e4b'),
    temperature: z.number().min(0).max(2).default(0.3),
    maxResponseTokens: z.number().default(4096),
    maxContextTokens: z.number().default(128000),
    maxTurns: z.number().min(500).max(2000).default(500),
    maxDuration: z.number().min(0).default(0),
    turnTimeout: z.number().min(30000).default(1200000),
    autoMemory: z.boolean().default(true),
    thinkingMode: z.boolean().default(false),
    enableSkillHarvest: z.boolean().default(true),
    enableMemoryNudge: z.boolean().default(true),
    enableReflector: z.boolean().default(true),
    enableSandbox: z.boolean().default(false),
    systemPrompt: z.string().optional(),
    conversationDir: z.string().optional(),
    language: z.enum(['auto', 'zh', 'en']).default('auto'),
    // Support both string (legacy) and array (new) for rules
    rules: z.union([
        z.string().default(''),
        z.array(RuleSchema).default([]),
    ]).default([]),
    tools: z.object({
        disabled: z.array(z.string()).default([]),
    }).default({}),
    session: z.object({
        autoExecute: z.boolean().default(false),
        blockedCommands: z.string().default('rm,mv,sudo,wget,curl,chown'),
        mcpTools: z.boolean().default(true),
        retrievalTools: z.boolean().default(true),
        fileEditOutsideWorkspace: z.boolean().default(false),
    }).default({}),
    wiki: z.object({
        model: z.string().default(''),
        language: z.enum(['en', 'zh']).default('zh'),
        maxFilesPerModule: z.number().default(50),
        ignorePaths: z.array(z.string()).default([]),
        concurrency: z.number().min(1).max(20).default(3),
    }).default({}),
    indexing: z.object({
        concurrency: z.number().min(1).max(20).default(5),
    }).default({}),
    integrations: z.object({
        browserAgent: z.object({
            browserType: z.enum(['builtin', 'chrome', 'firefox', 'edge']).default('builtin'),
            executionPolicy: z.enum(['always', 'ask', 'never', 'auto']).default('ask'),
            toolsAutoExecute: z.boolean().default(true),
        }).default({}),
        planAgent: z.object({
            executionPolicy: z.enum(['always', 'ask', 'never', 'auto']).default('ask'),
        }).default({}),
        builtinBrowser: z.boolean().default(true),
    }).default({}),
    quest: z.object({
        worktreeScript: z.string().optional(),
        github: z.object({
            repo: z.string().optional(),
            token: z.string().optional(),
            connected: z.boolean().optional(),
        }).optional(),
        remote: z.object({
            dockerfile: z.string().optional(),
            installScript: z.string().optional(),
        }).optional(),
    }).optional(),
});
//# sourceMappingURL=schema.js.map