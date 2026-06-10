export interface SSEEvent {
    event?: string;
    data: string;
    id?: string;
}
/**
 * Parse an SSE stream from a fetch Response body.
 * Handles:
 * - data: fields (including multi-line)
 * - event: fields
 * - id: fields
 * - [DONE] sentinel from OpenAI
 */
export declare function parseSSEStream(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncIterable<SSEEvent>;
//# sourceMappingURL=sse-parser.d.ts.map