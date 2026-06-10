// Server-Sent Events (SSE) stream parser
// Used by OpenAI and Anthropic providers
/**
 * Parse an SSE stream from a fetch Response body.
 * Handles:
 * - data: fields (including multi-line)
 * - event: fields
 * - id: fields
 * - [DONE] sentinel from OpenAI
 */
export async function* parseSSEStream(body, signal) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            if (signal?.aborted)
                break;
            let chunk;
            try {
                chunk = await reader.read();
            }
            catch (err) {
                // reader.read() throws when the stream is aborted
                if (signal?.aborted || (err instanceof Error && (err.name === 'AbortError' || err.message?.includes('terminated') || err.message?.includes('abort')))) {
                    break; // Normal abort/termination, not an error
                }
                throw err; // Re-throw other errors
            }
            const { done, value } = chunk;
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // SSE events are separated by double newlines
            const parts = buffer.split('\n\n');
            // Keep the last incomplete part in the buffer
            buffer = parts.pop() ?? '';
            for (const part of parts) {
                const event = parseSSEEvent(part);
                if (event) {
                    // Skip [DONE] sentinel
                    if (event.data === '[DONE]')
                        continue;
                    yield event;
                }
            }
        }
        // Process remaining buffer
        if (buffer.trim()) {
            const event = parseSSEEvent(buffer);
            if (event && event.data !== '[DONE]') {
                yield event;
            }
        }
    }
    finally {
        reader.releaseLock();
    }
}
function parseSSEEvent(raw) {
    const lines = raw.split('\n');
    let eventType;
    let id;
    const dataLines = [];
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            dataLines.push(line.slice(6));
        }
        else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5));
        }
        else if (line.startsWith('event: ')) {
            eventType = line.slice(7);
        }
        else if (line.startsWith('event:')) {
            eventType = line.slice(6);
        }
        else if (line.startsWith('id: ')) {
            id = line.slice(4);
        }
        else if (line.startsWith('id:')) {
            id = line.slice(3);
        }
        // Ignore comments (lines starting with :) and empty lines
    }
    if (dataLines.length === 0)
        return null;
    return {
        event: eventType,
        data: dataLines.join('\n'),
        id,
    };
}
//# sourceMappingURL=sse-parser.js.map