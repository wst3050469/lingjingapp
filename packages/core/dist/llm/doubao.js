// Doubao (豆包) Responses API Provider
// Uses the v3 /responses endpoint (non-OpenAI-compatible format)
import { parseSSEStream } from './sse-parser.js';
import { logger } from '../utils/logger.js';
const DEFAULT_TIMEOUT_MS = 120_000;
function signalWithTimeout(parentSignal, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('LLM request timed out')), timeoutMs);
    if (parentSignal) {
        if (parentSignal.aborted) {
            controller.abort(parentSignal.reason);
            clearTimeout(timeoutId);
        }
        else {
            parentSignal.addEventListener('abort', () => {
                controller.abort(parentSignal.reason);
                clearTimeout(timeoutId);
            }, { once: true });
        }
    }
    return { signal: controller.signal, clear: () => clearTimeout(timeoutId) };
}
/**
 * Check if an error is a transient network error that can be retried.
 */
function isRecoverableNetworkError(err) {
    const msg = (err?.message || '').toLowerCase();
    const name = (err?.name || '').toLowerCase();
    if (name === 'aborterror' || name === 'timeouterror' || msg.includes('abort') || msg.includes('timeout')) return false;
    return msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('econnrefused') ||
        msg.includes('enotfound') || msg.includes('etimedout') || msg.includes('network') ||
        msg.includes('dns') || msg.includes('eai_again') || msg.includes('socket');
}
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.status >= 500 && attempt < maxRetries) {
                logger.warn(`[Doubao] HTTP ${response.status} on attempt ${attempt+1}/${maxRetries+1}, retrying...`);
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                continue;
            }
            return response;
        } catch (err) {
            lastError = err;
            if (!isRecoverableNetworkError(err) || attempt >= maxRetries) throw err;
            const delay = Math.pow(2, attempt) * 1000;
            logger.warn(`[Doubao] Fetch failed attempt ${attempt+1}/${maxRetries+1}: ${err.message}. Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
}
/** Convert Doubao Responses API content blocks to text */
function extractText(output) {
    const parts = [];
    for (const item of output) {
        if (item.type === 'message' && item.content) {
            for (const block of item.content) {
                if (block.type === 'output_text' && block.text) {
                    parts.push(block.text);
                }
            }
        }
    }
    return parts.join('');
}
// ── Provider ──
export class DoubaoProvider {
    name = 'doubao';
    model;
    apiKey;
    baseUrl;
    constructor(options) {
        this.model = options.model;
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl ?? 'https://ark.cn-beijing.volces.com/api/v3';
    }
    async *chat(request) {
        const input = this.convertMessages(request.messages, request.systemPrompt);
        const tools = request.tools ? this.convertTools(request.tools) : undefined;
        const body = {
            model: this.model,
            input,
            stream: true,
        };
        if (tools && tools.length > 0) {
            body.tools = tools;
            body.tool_choice = request.toolChoice || 'auto';
        }
        if (request.maxTokens) {
            body.max_output_tokens = request.maxTokens;
        }
        if (request.temperature !== undefined) {
            body.temperature = Math.min(Math.max(request.temperature, 0), 1);
        }
        const _timeout = signalWithTimeout(request.signal);
        const url = `${this.baseUrl}/responses`;
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: _timeout.signal,
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => 'Unknown error');
            throw new Error(`Doubao API error (${response.status}): ${errorBody.slice(0, 500)}`);
        }
        if (!response.body) {
            throw new Error('Doubao API returned no response body');
        }
        // Parse SSE stream
        const textBuffer = [];
        const toolCalls = new Map();
        let syntheticIdCounter = 0;
        // For non-streaming fallback - check content type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream') && !body.stream) {
            // Non-streaming mode - parse JSON directly
            const json = await response.json();
            const text = extractText(json.output);
            if (text)
                yield { type: 'text_delta', text };
            if (json.usage) {
                yield {
                    type: 'usage',
                    inputTokens: json.usage.input_tokens,
                    outputTokens: json.usage.output_tokens,
                };
            }
            yield { type: 'done' };
            return;
        }
        // Streaming mode - parse SSE
        try {
            for await (const sseEvent of parseSSEStream(response.body, _timeout.signal)) {
                let data;
                try {
                    data = JSON.parse(sseEvent.data);
                }
                catch {
                    continue;
                }
                // Handle event.type-based routing (Responses API uses type field in JSON)
                switch (data.type) {
                    case 'response.output_text.delta': {
                        const delta = data.delta;
                        if (delta) {
                            textBuffer.push(delta);
                            yield { type: 'text_delta', text: delta };
                        }
                        break;
                    }
                    case 'response.function_call_arguments.delta': {
                        const fcDelta = data;
                        const idx = fcDelta.output_index ?? 0;
                        if (!toolCalls.has(idx)) {
                            const id = fcDelta.item_id || `call_doubao_${Date.now()}_${syntheticIdCounter++}`;
                            toolCalls.set(idx, { id, name: '', args: '', started: false });
                        }
                        const buf = toolCalls.get(idx);
                        buf.args += fcDelta.delta;
                        if (!buf.started) {
                            // We don't know the name yet; wait for done event or first delta
                        }
                        break;
                    }
                    case 'response.function_call_arguments.done': {
                        const fcDone = data;
                        const idx = fcDone.output_index ?? 0;
                        if (!toolCalls.has(idx)) {
                            const id = fcDone.call_id || fcDone.item_id || `call_doubao_${Date.now()}_${syntheticIdCounter++}`;
                            toolCalls.set(idx, { id, name: fcDone.name || '', args: '', started: false });
                        }
                        const buf = toolCalls.get(idx);
                        if (fcDone.name)
                            buf.name = fcDone.name;
                        if (fcDone.call_id)
                            buf.id = fcDone.call_id;
                        if (fcDone.arguments)
                            buf.args = fcDone.arguments;
                        if (!buf.started && buf.name) {
                            buf.started = true;
                            yield { type: 'tool_call_start', id: buf.id, name: buf.name };
                        }
                        break;
                    }
                    case 'response.completed': {
                        const completed = data;
                        if (completed.response?.usage) {
                            yield {
                                type: 'usage',
                                inputTokens: completed.response.usage.input_tokens,
                                outputTokens: completed.response.usage.output_tokens,
                            };
                        }
                        // Flush any pending tool calls
                        for (const [, buf] of toolCalls) {
                            if (!buf.started && buf.name && buf.args) {
                                yield { type: 'tool_call_start', id: buf.id, name: buf.name };
                                yield { type: 'tool_call_delta', id: buf.id, args: buf.args };
                            }
                            else if (buf.started && buf.args) {
                                yield { type: 'tool_call_delta', id: buf.id, args: '' }; // final empty delta to signal end
                            }
                            if (buf.started) {
                                yield { type: 'tool_call_end', id: buf.id };
                            }
                        }
                        yield { type: 'done' };
                        break;
                    }
                    default:
                        // Ignore unknown event types (e.g., response.created, response.in_progress)
                        break;
                }
            }
        }
        finally {
            _timeout.clear();
        }
    }
    // ── Private helpers ──
    convertMessages(messages, systemPrompt) {
        const input = [];
        // System prompt as first input item (developer role preferred for Responses API)
        if (systemPrompt) {
            input.push({
                role: 'developer',
                content: [{ type: 'input_text', text: systemPrompt }],
            });
        }
        for (const msg of messages) {
            switch (msg.role) {
                case 'user': {
                    const content = this.convertUserContent(msg.content);
                    input.push({ role: 'user', content });
                    break;
                }
                case 'assistant': {
                    // For tool call responses, we might need different formatting
                    if (msg.toolCalls && msg.toolCalls.length > 0) {
                        // Assistant message with tool calls - convert to function_call output format
                        // The Responses API expects function calls to be part of the assistant output
                        // For now, just include text content
                        if (msg.content) {
                            input.push({
                                role: 'assistant',
                                content: msg.content,
                            });
                        }
                    }
                    else {
                        input.push({
                            role: 'assistant',
                            content: msg.content || '',
                        });
                    }
                    break;
                }
                case 'tool': {
                    // Tool results - in Responses API these are typically function_call_output items
                    // We pass them as a user message with the tool result content
                    input.push({
                        role: 'user',
                        content: [{ type: 'input_text', text: `工具调用结果 (${msg.toolCallId}): ${msg.content}` }],
                    });
                    break;
                }
            }
        }
        return input;
    }
    convertUserContent(content) {
        if (typeof content === 'string') {
            return content;
        }
        const blocks = [];
        for (const block of content) {
            if (block.type === 'text') {
                blocks.push({ type: 'input_text', text: block.text });
            }
            else if (block.type === 'image') {
                // Convert base64 data to data URL if needed
                const imageUrl = block.data.startsWith('http')
                    ? block.data
                    : `data:${block.mediaType};base64,${block.data}`;
                blocks.push({ type: 'input_image', image_url: imageUrl });
            }
        }
        return blocks.length === 1 && blocks[0].type === 'input_text'
            ? (blocks[0].text || '')
            : blocks;
    }
    convertTools(tools) {
        return tools.map((t) => ({
            type: 'function',
            name: t.name,
            description: t.description,
            parameters: t.parameters,
        }));
    }
}
//# sourceMappingURL=doubao.js.map