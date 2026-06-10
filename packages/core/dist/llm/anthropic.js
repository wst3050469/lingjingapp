// Anthropic Claude API provider implementation
import { parseSSEStream } from './sse-parser.js';
import { logger } from '../utils/logger.js';
/**
 * Check if an error is a transient network error that can be retried.
 */
function isRecoverableNetworkError(err) {
    const msg = (err?.message || '').toLowerCase();
    const name = (err?.name || '').toLowerCase();
    if (name === 'aborterror' || name === 'timeouterror' || msg.includes('abort') || msg.includes('timeout')) return false;
    return msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('econnrefused') ||
        msg.includes('enotfound') || msg.includes('etimedout') || msg.includes('network') ||
        msg.includes('dns') || msg.includes('eai_again') || msg.includes('socket') ||
        msg.includes('tls') || msg.includes('ssl') || msg.includes('unable to connect');
}
async function fetchWithRetry(url, options = {}, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.status >= 500 && attempt < maxRetries) {
                logger.warn(`[Anthropic] HTTP ${response.status} on attempt ${attempt+1}/${maxRetries+1}, retrying...`);
                await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
                continue;
            }
            return response;
        } catch (err) {
            lastError = err;
            if (!isRecoverableNetworkError(err) || attempt >= maxRetries) throw err;
            const delay = Math.pow(2, attempt) * 1000;
            logger.warn(`[Anthropic] Fetch failed attempt ${attempt+1}/${maxRetries+1}: ${err.message}. Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
}
export class AnthropicProvider {
    name = 'anthropic';
    model;
    apiKey;
    baseUrl;
    constructor(options) {
        this.model = options.model;
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com';
    }
    async *chat(request) {
        const messages = this.convertMessages(request.messages);
        const tools = request.tools ? this.convertTools(request.tools) : undefined;
        const body = {
            model: this.model,
            messages,
            max_tokens: request.maxTokens ?? 4096,
            stream: true,
        };
        if (request.systemPrompt) {
            body.system = request.systemPrompt;
        }
        if (tools && tools.length > 0) {
            body.tools = tools;
        }
        if (request.temperature !== undefined) {
            body.temperature = request.temperature;
        }
        logger.debug('Anthropic request:', JSON.stringify(body, null, 2).slice(0, 500));
        const response = await fetchWithRetry(`${this.baseUrl}/v1/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
            signal: request.signal,
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
        }
        if (!response.body) {
            throw new Error('No response body from Anthropic');
        }
        // Track current content block for tool call assembly
        let currentToolCallId = '';
        let currentToolCallName = '';
        let currentToolCallArgs = '';
        for await (const sseEvent of parseSSEStream(response.body, request.signal)) {
            let data;
            try {
                data = JSON.parse(sseEvent.data);
            }
            catch {
                continue;
            }
            const eventType = sseEvent.event ?? data.type;
            switch (eventType) {
                case 'message_start': {
                    const message = data.message;
                    if (message?.usage) {
                        yield {
                            type: 'usage',
                            inputTokens: message.usage.input_tokens,
                            outputTokens: 0,
                        };
                    }
                    break;
                }
                case 'content_block_start': {
                    const block = data.content_block;
                    if (block?.type === 'tool_use' && block.id && block.name) {
                        currentToolCallId = block.id;
                        currentToolCallName = block.name;
                        currentToolCallArgs = '';
                        yield { type: 'tool_call_start', id: block.id, name: block.name };
                    }
                    break;
                }
                case 'content_block_delta': {
                    const delta = data.delta;
                    if (delta?.type === 'text_delta' && delta.text) {
                        yield { type: 'text_delta', text: delta.text };
                    }
                    else if (delta?.type === 'input_json_delta' && delta.partial_json) {
                        currentToolCallArgs += delta.partial_json;
                        yield { type: 'tool_call_delta', id: currentToolCallId, args: delta.partial_json };
                    }
                    break;
                }
                case 'content_block_stop': {
                    if (currentToolCallId) {
                        yield { type: 'tool_call_end', id: currentToolCallId };
                        currentToolCallId = '';
                        currentToolCallName = '';
                        currentToolCallArgs = '';
                    }
                    break;
                }
                case 'message_delta': {
                    const delta = data.delta;
                    const usage = data.usage;
                    if (usage?.output_tokens) {
                        yield { type: 'usage', inputTokens: 0, outputTokens: usage.output_tokens };
                    }
                    break;
                }
                case 'message_stop':
                    break;
            }
        }
        yield { type: 'done' };
    }
    convertMessages(messages) {
        const result = [];
        for (const msg of messages) {
            switch (msg.role) {
                case 'user':
                    if (Array.isArray(msg.content)) {
                        // Multi-modal: ContentBlock[] — convert to Anthropic content array
                        const anthropicBlocks = msg.content.map(block => {
                            if (block.type === 'text') {
                                return { type: 'text', text: block.text };
                            }
                            if (block.type === 'image') {
                                return {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: block.mediaType,
                                        data: block.data,
                                    },
                                };
                            }
                            return { type: 'text', text: '' };
                        });
                        result.push({ role: 'user', content: anthropicBlocks });
                    }
                    else {
                        result.push({ role: 'user', content: msg.content || '' });
                    }
                    break;
                case 'assistant': {
                    const content = [];
                    if (msg.content) {
                        content.push({ type: 'text', text: msg.content });
                    }
                    if (msg.toolCalls) {
                        for (const tc of msg.toolCalls) {
                            content.push({
                                type: 'tool_use',
                                id: tc.id,
                                name: tc.name,
                                input: tc.arguments,
                            });
                        }
                    }
                    // Ensure content array is never empty — some APIs reject it
                    if (content.length === 0) {
                        content.push({ type: 'text', text: '' });
                    }
                    result.push({ role: 'assistant', content });
                    break;
                }
                case 'tool': {
                    // Anthropic expects tool results as user messages with tool_result content
                    result.push({
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                tool_use_id: msg.toolCallId,
                                content: msg.content,
                                is_error: msg.isError ?? false,
                            },
                        ],
                    });
                    break;
                }
            }
        }
        return result;
    }
    convertTools(tools) {
        return tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters,
        }));
    }
}
//# sourceMappingURL=anthropic.js.map