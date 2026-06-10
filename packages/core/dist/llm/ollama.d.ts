import type { LLMProvider, ChatRequest, StreamEvent } from './types.js';
export declare class OllamaProvider implements LLMProvider {
    readonly name: string;
    readonly model: string;
    private readonly baseUrl;
    private readonly apiKey?;
    private static readonly VISION_MODELS;
    private get supportsVision();
    constructor(options: {
        model: string;
        baseUrl?: string;
        apiKey?: string;
    });
    chat(request: ChatRequest): AsyncIterable<StreamEvent>;
    private convertMessages;
    private convertTools;
}
//# sourceMappingURL=ollama.d.ts.map