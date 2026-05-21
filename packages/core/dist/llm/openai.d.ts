import type { LLMProvider, ChatRequest, StreamEvent } from './types.js';
export declare class OpenAIProvider implements LLMProvider {
    readonly name: string;
    readonly model: string;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly sendStreamOptions;
    /** Known vision-capable model name fragments */
    private static readonly VISION_MODELS;
    /**
     * Whether the current model likely supports image_url content blocks.
     * Conservative: only known vision models return true. Unknown models return false
     * to avoid sending image_url to APIs that don't understand it.
     */
    private get supportsVision();
    constructor(options: {
        model: string;
        apiKey: string;
        baseUrl?: string;
        sendStreamOptions?: boolean;
    });
    chat(request: ChatRequest): AsyncIterable<StreamEvent>;
    /**
     * DeepSeek non-streaming tool call path.
     * Uses a single non-streaming request to ensure tool_calls are returned atomically,
     * bypassing streaming issues where tool calls leak into content as special markers.
     */
    private deepSeekNonStreamingToolCall;
    /**
     * Parse a complete (non-streaming) chat completion response into StreamEvents.
     */
    private parseNonStreamingResponse;
    private convertMessages;
    private convertTools;
}
//# sourceMappingURL=openai.d.ts.map