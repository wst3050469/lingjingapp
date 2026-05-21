interface LLMProvider {
    chat: (opts: {
        messages: Array<{
            role: string;
            content: string;
        }>;
        systemPrompt?: string;
        maxTokens?: number;
        temperature?: number;
        [key: string]: unknown;
    }) => AsyncIterable<{
        type: string;
        text?: string;
        [key: string]: unknown;
    }>;
}
export interface ReflectorConfig {
    /** How often to run reflection (ms). Default: 24 hours */
    intervalMs: number;
    enabled: boolean;
    /** LLM provider for synthesis */
    provider: LLMProvider;
}
export interface MemoryRecord {
    id: string;
    title: string;
    content: string;
    category: string;
    scope: string;
    updated_at?: string;
}
export interface ReflectionResult {
    profile: string;
    projectKnowledge: string;
    decisions: string;
    fullMarkdown: string;
    sourceMemoryCount: number;
    reflectedAt: Date;
}
export declare class MemoryReflector {
    private config;
    private lastReflection;
    constructor(config: ReflectorConfig);
    /**
     * Check if it's time to run a reflection cycle.
     */
    shouldReflect(): boolean;
    /**
     * Run a full reflection cycle: read memories → synthesize → return profile.
     * @param memories Recent memory records to reflect on
     */
    reflect(memories: MemoryRecord[]): Promise<ReflectionResult | null>;
}
export {};
//# sourceMappingURL=reflector.d.ts.map