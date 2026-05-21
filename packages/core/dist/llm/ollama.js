// Ollama provider - uses native /api/chat endpoint for full tool calling support
// The OpenAI-compatible /v1 endpoint does NOT return tool_calls for many models (e.g. gemma4)
import { logger } from '../utils/logger.js';
/** Default timeout for any single LLM HTTP request (10 minutes). */
const DEFAULT_LLM_TIMEOUT = 600_000;
function signalWithTimeout(originalSignal, timeoutMs) {
    const controller = new AbortController();
    const timer = timeoutMs > 0
        ? setTimeout(() => controller.abort(new DOMException(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s`, 'TimeoutError')), timeoutMs)
        : undefined;
    const onOriginalAbort = () => { if (timer)
        clearTimeout(timer); controller.abort(originalSignal?.reason); };
    if (originalSignal) {
        if (originalSignal.aborted) {
            if (timer)
                clearTimeout(timer);
            controller.abort(originalSignal.reason);
        }
        else {
            originalSignal.addEventListener('abort', onOriginalAbort, { once: true });
        }
    }
    return { signal: controller.signal, clear: () => { if (timer)
            clearTimeout(timer); if (originalSignal)
            originalSignal.removeEventListener('abort', onOriginalAbort); } };
}
export class OllamaProvider {
    name = 'ollama';
    model;
    baseUrl;
    apiKey;
    static VISION_MODELS = [
        'llava', 'bakllava', 'minicpm-v', 'gemma3', 'llama3.2-vision',
    ];
    get supportsVision() {
        return OllamaProvider.VISION_MODELS.some(m => this.model.includes(m));
    }
    constructor(options) {
        this.model = options.model;
        this.baseUrl = (options.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
        this.apiKey = options.apiKey;
    }
    async *chat(request) {
        const messages = this.convertMessages(request.messages, request.systemPrompt);
        const tools = request.tools && request.tools.length > 0 ? this.convertTools(request.tools) : undefined;
        const body = {
            model: this.model,
            messages,
            stream: true,
        };
        if (tools) {
            body.tools = tools;
        }
        if (request.maxTokens) {
            body.options = { ...(body.options || {}), num_predict: request.maxTokens };
        }
        if (request.temperature !== undefined) {
            body.options = { ...(body.options || {}), temperature: Math.min(request.temperature, tools ? 0.7 : 2) };
        }
        const _llmTimeout = signalWithTimeout(request.signal, DEFAULT_LLM_TIMEOUT);
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        logger.info(`[Ollama Native] model=${this.model}, msgs=${messages.length}, tools=${tools ? tools.length : 0}, endpoint=${this.baseUrl}/api/chat`);
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: _llmTimeout.signal,
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Ollama API error (${response.status}): ${errorBody.slice(0, 500)}`);
        }
        if (!response.body) {
            throw new Error('No response body from Ollama');
        }
        // Parse NDJSON stream (one JSON object per line)
        let accumulatedText = '';
        const emittedToolCalls = new Set(); // Track tool calls to avoid duplicates
        let syntheticIdCounter = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    let data;
                    try {
                        data = JSON.parse(trimmed);
                    }
                    catch {
                        continue;
                    }
                    const message = data.message;
                    // Text content (may be incremental)
                    if (message?.content) {
                        accumulatedText += message.content;
                        yield { type: 'text_delta', text: message.content };
                    }
                    // Tool calls (Ollama native gives complete objects, not incremental deltas)
                    if (message?.tool_calls) {
                        for (const tc of message.tool_calls) {
                            const name = tc.function.name;
                            const argsObj = tc.function.arguments || {};
                            const key = `${name}:${JSON.stringify(argsObj)}`;
                            if (emittedToolCalls.has(key))
                                continue;
                            emittedToolCalls.add(key);
                            const id = `call_ollama_${Date.now()}_${syntheticIdCounter++}`;
                            yield { type: 'tool_call_start', id, name };
                            yield { type: 'tool_call_delta', id, args: JSON.stringify(argsObj) };
                            yield { type: 'tool_call_end', id };
                        }
                    }
                    // Usage stats (in final done:true message)
                    if (data.done && (data.eval_count !== undefined || data.prompt_eval_count !== undefined)) {
                        yield {
                            type: 'usage',
                            inputTokens: data.prompt_eval_count || 0,
                            outputTokens: data.eval_count || 0,
                        };
                    }
                }
            }
        }
        finally {
            reader.releaseLock();
        }
        yield { type: 'done' };
        _llmTimeout.clear();
    }
    // ── Message conversion (Ollama native format) ──
    convertMessages(messages, systemPrompt) {
        const result = [];
        // Map from toolCallId → function name for tool result messages
        const callIdToName = new Map();
        if (systemPrompt) {
            result.push({ role: 'system', content: systemPrompt });
        }
        for (const msg of messages) {
            switch (msg.role) {
                case 'user':
                    if (Array.isArray(msg.content)) {
                        const textParts = [];
                        const images = [];
                        for (const block of msg.content) {
                            if (block.type === 'text') {
                                textParts.push(block.text);
                            }
                            else if (block.type === 'image') {
                                if (this.supportsVision) {
                                    images.push(block.data);
                                }
                            }
                        }
                        const content = textParts.join('\n') || (images.length > 0 ? 'Please analyze this image.' : '');
                        if (images.length > 0 && this.supportsVision) {
                            result.push({ role: 'user', content, images });
                        }
                        else if (images.length > 0) {
                            result.push({ role: 'user', content: '[图片已附加，但当前模型不支持图片识别] ' + content });
                        }
                        else {
                            result.push({ role: 'user', content });
                        }
                    }
                    else {
                        result.push({ role: 'user', content: msg.content || '' });
                    }
                    break;
                case 'assistant': {
                    const ollamaMsg = {
                        role: 'assistant',
                        content: msg.content || '',
                    };
                    if (msg.toolCalls && msg.toolCalls.length > 0) {
                        ollamaMsg.tool_calls = msg.toolCalls.map(tc => {
                            callIdToName.set(tc.id, tc.name); // Remember ID→name for tool results
                            return {
                                function: {
                                    name: tc.name,
                                    arguments: tc.arguments,
                                },
                            };
                        });
                    }
                    result.push(ollamaMsg);
                    break;
                }
                case 'tool': {
                    // Ollama native API uses "tool_name" (function name), not "tool_call_id"
                    const toolName = callIdToName.get(msg.toolCallId) || msg.toolCallId;
                    result.push({
                        role: 'tool',
                        content: msg.content || '',
                        tool_name: toolName,
                    });
                    break;
                }
            }
        }
        return result;
    }
    // ── Tool schema conversion (OpenAI format → Ollama native format) ──
    convertTools(tools) {
        return tools.map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
    }
}
//# sourceMappingURL=ollama.js.map