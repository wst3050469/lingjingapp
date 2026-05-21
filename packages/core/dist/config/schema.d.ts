import { z } from 'zod';
declare const RuleSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["manual", "model", "always", "filePattern"]>;
    content: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    filePatterns: z.ZodOptional<z.ZodString>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    content: string;
    name: string;
    id: string;
    type: "model" | "manual" | "always" | "filePattern";
    enabled: boolean;
    description?: string | undefined;
    filePatterns?: string | undefined;
}, {
    content: string;
    name: string;
    id: string;
    type: "model" | "manual" | "always" | "filePattern";
    description?: string | undefined;
    enabled?: boolean | undefined;
    filePatterns?: string | undefined;
}>;
export declare const AppConfigSchema: z.ZodObject<{
    apiKeys: z.ZodDefault<z.ZodObject<{
        openai: z.ZodOptional<z.ZodString>;
        anthropic: z.ZodOptional<z.ZodString>;
        deepseek: z.ZodOptional<z.ZodString>;
        baidu: z.ZodOptional<z.ZodString>;
        tencent: z.ZodOptional<z.ZodString>;
        kimi: z.ZodOptional<z.ZodString>;
        qwen: z.ZodOptional<z.ZodString>;
        doubao: z.ZodOptional<z.ZodString>;
        glm: z.ZodOptional<z.ZodString>;
        minimax: z.ZodOptional<z.ZodString>;
        jinmo: z.ZodOptional<z.ZodString>;
        gemma: z.ZodOptional<z.ZodString>;
        qwen35b: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        openai?: string | undefined;
        deepseek?: string | undefined;
        anthropic?: string | undefined;
        baidu?: string | undefined;
        tencent?: string | undefined;
        kimi?: string | undefined;
        qwen?: string | undefined;
        doubao?: string | undefined;
        glm?: string | undefined;
        minimax?: string | undefined;
        jinmo?: string | undefined;
        gemma?: string | undefined;
        qwen35b?: string | undefined;
    }, {
        openai?: string | undefined;
        deepseek?: string | undefined;
        anthropic?: string | undefined;
        baidu?: string | undefined;
        tencent?: string | undefined;
        kimi?: string | undefined;
        qwen?: string | undefined;
        doubao?: string | undefined;
        glm?: string | undefined;
        minimax?: string | undefined;
        jinmo?: string | undefined;
        gemma?: string | undefined;
        qwen35b?: string | undefined;
    }>>;
    ollama: z.ZodDefault<z.ZodObject<{
        baseUrl: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        baseUrl: string;
    }, {
        baseUrl?: string | undefined;
    }>>;
    custom: z.ZodDefault<z.ZodObject<{
        name: z.ZodDefault<z.ZodString>;
        baseUrl: z.ZodDefault<z.ZodString>;
        apiKey: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        apiKey: string;
        baseUrl: string;
    }, {
        name?: string | undefined;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
    }>>;
    model: z.ZodDefault<z.ZodString>;
    temperature: z.ZodDefault<z.ZodNumber>;
    maxResponseTokens: z.ZodDefault<z.ZodNumber>;
    maxContextTokens: z.ZodDefault<z.ZodNumber>;
    maxTurns: z.ZodDefault<z.ZodNumber>;
    maxDuration: z.ZodDefault<z.ZodNumber>;
    turnTimeout: z.ZodDefault<z.ZodNumber>;
    autoMemory: z.ZodDefault<z.ZodBoolean>;
    thinkingMode: z.ZodDefault<z.ZodBoolean>;
    enableSkillHarvest: z.ZodDefault<z.ZodBoolean>;
    enableMemoryNudge: z.ZodDefault<z.ZodBoolean>;
    enableReflector: z.ZodDefault<z.ZodBoolean>;
    enableSandbox: z.ZodDefault<z.ZodBoolean>;
    systemPrompt: z.ZodOptional<z.ZodString>;
    conversationDir: z.ZodOptional<z.ZodString>;
    language: z.ZodDefault<z.ZodEnum<["auto", "zh", "en"]>>;
    rules: z.ZodDefault<z.ZodUnion<[z.ZodDefault<z.ZodString>, z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodEnum<["manual", "model", "always", "filePattern"]>;
        content: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        filePatterns: z.ZodOptional<z.ZodString>;
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        name: string;
        id: string;
        type: "model" | "manual" | "always" | "filePattern";
        enabled: boolean;
        description?: string | undefined;
        filePatterns?: string | undefined;
    }, {
        content: string;
        name: string;
        id: string;
        type: "model" | "manual" | "always" | "filePattern";
        description?: string | undefined;
        enabled?: boolean | undefined;
        filePatterns?: string | undefined;
    }>, "many">>]>>;
    tools: z.ZodDefault<z.ZodObject<{
        disabled: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        disabled: string[];
    }, {
        disabled?: string[] | undefined;
    }>>;
    session: z.ZodDefault<z.ZodObject<{
        autoExecute: z.ZodDefault<z.ZodBoolean>;
        blockedCommands: z.ZodDefault<z.ZodString>;
        mcpTools: z.ZodDefault<z.ZodBoolean>;
        retrievalTools: z.ZodDefault<z.ZodBoolean>;
        fileEditOutsideWorkspace: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        autoExecute: boolean;
        blockedCommands: string;
        mcpTools: boolean;
        retrievalTools: boolean;
        fileEditOutsideWorkspace: boolean;
    }, {
        autoExecute?: boolean | undefined;
        blockedCommands?: string | undefined;
        mcpTools?: boolean | undefined;
        retrievalTools?: boolean | undefined;
        fileEditOutsideWorkspace?: boolean | undefined;
    }>>;
    wiki: z.ZodDefault<z.ZodObject<{
        model: z.ZodDefault<z.ZodString>;
        language: z.ZodDefault<z.ZodEnum<["en", "zh"]>>;
        maxFilesPerModule: z.ZodDefault<z.ZodNumber>;
        ignorePaths: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        concurrency: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        language: "zh" | "en";
        maxFilesPerModule: number;
        ignorePaths: string[];
        concurrency: number;
    }, {
        model?: string | undefined;
        language?: "zh" | "en" | undefined;
        maxFilesPerModule?: number | undefined;
        ignorePaths?: string[] | undefined;
        concurrency?: number | undefined;
    }>>;
    indexing: z.ZodDefault<z.ZodObject<{
        concurrency: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        concurrency: number;
    }, {
        concurrency?: number | undefined;
    }>>;
    integrations: z.ZodDefault<z.ZodObject<{
        browserAgent: z.ZodDefault<z.ZodObject<{
            browserType: z.ZodDefault<z.ZodEnum<["builtin", "chrome", "firefox", "edge"]>>;
            executionPolicy: z.ZodDefault<z.ZodEnum<["always", "ask", "never", "auto"]>>;
            toolsAutoExecute: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            browserType: "builtin" | "chrome" | "firefox" | "edge";
            executionPolicy: "auto" | "always" | "ask" | "never";
            toolsAutoExecute: boolean;
        }, {
            browserType?: "builtin" | "chrome" | "firefox" | "edge" | undefined;
            executionPolicy?: "auto" | "always" | "ask" | "never" | undefined;
            toolsAutoExecute?: boolean | undefined;
        }>>;
        planAgent: z.ZodDefault<z.ZodObject<{
            executionPolicy: z.ZodDefault<z.ZodEnum<["always", "ask", "never", "auto"]>>;
        }, "strip", z.ZodTypeAny, {
            executionPolicy: "auto" | "always" | "ask" | "never";
        }, {
            executionPolicy?: "auto" | "always" | "ask" | "never" | undefined;
        }>>;
        builtinBrowser: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        browserAgent: {
            browserType: "builtin" | "chrome" | "firefox" | "edge";
            executionPolicy: "auto" | "always" | "ask" | "never";
            toolsAutoExecute: boolean;
        };
        planAgent: {
            executionPolicy: "auto" | "always" | "ask" | "never";
        };
        builtinBrowser: boolean;
    }, {
        browserAgent?: {
            browserType?: "builtin" | "chrome" | "firefox" | "edge" | undefined;
            executionPolicy?: "auto" | "always" | "ask" | "never" | undefined;
            toolsAutoExecute?: boolean | undefined;
        } | undefined;
        planAgent?: {
            executionPolicy?: "auto" | "always" | "ask" | "never" | undefined;
        } | undefined;
        builtinBrowser?: boolean | undefined;
    }>>;
    quest: z.ZodOptional<z.ZodObject<{
        worktreeScript: z.ZodOptional<z.ZodString>;
        github: z.ZodOptional<z.ZodObject<{
            repo: z.ZodOptional<z.ZodString>;
            token: z.ZodOptional<z.ZodString>;
            connected: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            token?: string | undefined;
            repo?: string | undefined;
            connected?: boolean | undefined;
        }, {
            token?: string | undefined;
            repo?: string | undefined;
            connected?: boolean | undefined;
        }>>;
        remote: z.ZodOptional<z.ZodObject<{
            dockerfile: z.ZodOptional<z.ZodString>;
            installScript: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            dockerfile?: string | undefined;
            installScript?: string | undefined;
        }, {
            dockerfile?: string | undefined;
            installScript?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        worktreeScript?: string | undefined;
        github?: {
            token?: string | undefined;
            repo?: string | undefined;
            connected?: boolean | undefined;
        } | undefined;
        remote?: {
            dockerfile?: string | undefined;
            installScript?: string | undefined;
        } | undefined;
    }, {
        worktreeScript?: string | undefined;
        github?: {
            token?: string | undefined;
            repo?: string | undefined;
            connected?: boolean | undefined;
        } | undefined;
        remote?: {
            dockerfile?: string | undefined;
            installScript?: string | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    model: string;
    custom: {
        name: string;
        apiKey: string;
        baseUrl: string;
    };
    maxTurns: number;
    maxDuration: number;
    turnTimeout: number;
    maxContextTokens: number;
    maxResponseTokens: number;
    temperature: number;
    tools: {
        disabled: string[];
    };
    enableSkillHarvest: boolean;
    enableMemoryNudge: boolean;
    enableReflector: boolean;
    enableSandbox: boolean;
    ollama: {
        baseUrl: string;
    };
    apiKeys: {
        openai?: string | undefined;
        deepseek?: string | undefined;
        anthropic?: string | undefined;
        baidu?: string | undefined;
        tencent?: string | undefined;
        kimi?: string | undefined;
        qwen?: string | undefined;
        doubao?: string | undefined;
        glm?: string | undefined;
        minimax?: string | undefined;
        jinmo?: string | undefined;
        gemma?: string | undefined;
        qwen35b?: string | undefined;
    };
    autoMemory: boolean;
    thinkingMode: boolean;
    language: "auto" | "zh" | "en";
    rules: string | {
        content: string;
        name: string;
        id: string;
        type: "model" | "manual" | "always" | "filePattern";
        enabled: boolean;
        description?: string | undefined;
        filePatterns?: string | undefined;
    }[];
    session: {
        autoExecute: boolean;
        blockedCommands: string;
        mcpTools: boolean;
        retrievalTools: boolean;
        fileEditOutsideWorkspace: boolean;
    };
    wiki: {
        model: string;
        language: "zh" | "en";
        maxFilesPerModule: number;
        ignorePaths: string[];
        concurrency: number;
    };
    indexing: {
        concurrency: number;
    };
    integrations: {
        browserAgent: {
            browserType: "builtin" | "chrome" | "firefox" | "edge";
            executionPolicy: "auto" | "always" | "ask" | "never";
            toolsAutoExecute: boolean;
        };
        planAgent: {
            executionPolicy: "auto" | "always" | "ask" | "never";
        };
        builtinBrowser: boolean;
    };
    systemPrompt?: string | undefined;
    conversationDir?: string | undefined;
    quest?: {
        worktreeScript?: string | undefined;
        github?: {
            token?: string | undefined;
            repo?: string | undefined;
            connected?: boolean | undefined;
        } | undefined;
        remote?: {
            dockerfile?: string | undefined;
            installScript?: string | undefined;
        } | undefined;
    } | undefined;
}, {
    model?: string | undefined;
    custom?: {
        name?: string | undefined;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
    } | undefined;
    maxTurns?: number | undefined;
    maxDuration?: number | undefined;
    turnTimeout?: number | undefined;
    maxContextTokens?: number | undefined;
    maxResponseTokens?: number | undefined;
    temperature?: number | undefined;
    tools?: {
        disabled?: string[] | undefined;
    } | undefined;
    systemPrompt?: string | undefined;
    enableSkillHarvest?: boolean | undefined;
    enableMemoryNudge?: boolean | undefined;
    enableReflector?: boolean | undefined;
    enableSandbox?: boolean | undefined;
    ollama?: {
        baseUrl?: string | undefined;
    } | undefined;
    apiKeys?: {
        openai?: string | undefined;
        deepseek?: string | undefined;
        anthropic?: string | undefined;
        baidu?: string | undefined;
        tencent?: string | undefined;
        kimi?: string | undefined;
        qwen?: string | undefined;
        doubao?: string | undefined;
        glm?: string | undefined;
        minimax?: string | undefined;
        jinmo?: string | undefined;
        gemma?: string | undefined;
        qwen35b?: string | undefined;
    } | undefined;
    autoMemory?: boolean | undefined;
    thinkingMode?: boolean | undefined;
    conversationDir?: string | undefined;
    language?: "auto" | "zh" | "en" | undefined;
    rules?: string | {
        content: string;
        name: string;
        id: string;
        type: "model" | "manual" | "always" | "filePattern";
        description?: string | undefined;
        enabled?: boolean | undefined;
        filePatterns?: string | undefined;
    }[] | undefined;
    session?: {
        autoExecute?: boolean | undefined;
        blockedCommands?: string | undefined;
        mcpTools?: boolean | undefined;
        retrievalTools?: boolean | undefined;
        fileEditOutsideWorkspace?: boolean | undefined;
    } | undefined;
    wiki?: {
        model?: string | undefined;
        language?: "zh" | "en" | undefined;
        maxFilesPerModule?: number | undefined;
        ignorePaths?: string[] | undefined;
        concurrency?: number | undefined;
    } | undefined;
    indexing?: {
        concurrency?: number | undefined;
    } | undefined;
    integrations?: {
        browserAgent?: {
            browserType?: "builtin" | "chrome" | "firefox" | "edge" | undefined;
            executionPolicy?: "auto" | "always" | "ask" | "never" | undefined;
            toolsAutoExecute?: boolean | undefined;
        } | undefined;
        planAgent?: {
            executionPolicy?: "auto" | "always" | "ask" | "never" | undefined;
        } | undefined;
        builtinBrowser?: boolean | undefined;
    } | undefined;
    quest?: {
        worktreeScript?: string | undefined;
        github?: {
            token?: string | undefined;
            repo?: string | undefined;
            connected?: boolean | undefined;
        } | undefined;
        remote?: {
            dockerfile?: string | undefined;
            installScript?: string | undefined;
        } | undefined;
    } | undefined;
}>;
export type AppConfig = z.infer<typeof AppConfigSchema>;
export type RuleConfig = z.infer<typeof RuleSchema>;
export {};
//# sourceMappingURL=schema.d.ts.map