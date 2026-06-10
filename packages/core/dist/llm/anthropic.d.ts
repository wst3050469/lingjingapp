import type { LLMProvider, ChatRequest, StreamEvent } from './types.js';
export declare class AnthropicProvider implements LLMProvider {
    readonly name = "anthropic";
    readonly model: string;
    private readonly apiKey;
    private readonly baseUrl;
    constructor(options: {
        model: string;
        apiKey: string;
        baseUrl?: string;
    });
    chat(request: ChatRequest): AsyncIterable<StreamEvent>;
    private convertMessages;
    private convertTools;
}
//# sourceMappingURL=anthropic.d.ts.map