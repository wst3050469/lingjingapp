export interface JSONSchema {
    type: string;
    properties?: Record<string, JSONSchema & {
        description?: string;
        enum?: string[];
    }>;
    required?: string[];
    items?: JSONSchema & {
        enum?: string[];
    };
    description?: string;
    default?: unknown;
    additionalProperties?: boolean;
    enum?: string[];
}
export interface ToolSchema {
    name: string;
    description: string;
    parameters: JSONSchema;
}
/** LLM provider configuration */
export interface LLMProvider {
    chat(opts: {
        messages: {
            role: string;
            content: string | unknown[];
        }[];
        tools?: unknown[];
        toolChoice?: unknown;
        systemPrompt?: string;
        maxTokens?: number;
        temperature?: number;
        signal?: AbortSignal;
    }): AsyncIterable<{
        type: string;
        text?: string;
        [key: string]: unknown;
    }>;
    name: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
}
/** Stream event from LLM */
export interface StreamEvent {
    type: "token" | "done" | "error";
    data?: string;
    error?: Error;
    finishReason?: string;
}
//# sourceMappingURL=types.d.ts.map