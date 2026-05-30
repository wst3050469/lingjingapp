// OpenAI API provider implementation
import { parseSSEStream } from './sse-parser.js';
import { logger } from '../utils/logger.js';
/** Default timeout for any single LLM HTTP request (10 minutes). */
const DEFAULT_LLM_TIMEOUT = 600_000;
/**
 * Combines an optional AbortSignal with a wall-clock timeout.
 * Returns a signal that aborts when either the original signal aborts OR the timeout expires.
 * Call clear() to cancel the timeout timer on normal completion.
 */
function signalWithTimeout(originalSignal, timeoutMs) {
    const controller = new AbortController();
    const timer = timeoutMs > 0
        ? setTimeout(() => controller.abort(new DOMException(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s (${Math.round(timeoutMs / 60000)} min). The model may be overloaded or the prompt is too complex. Try again or reduce context length.`, 'TimeoutError')), timeoutMs)
        : undefined;
    const onOriginalAbort = () => {
        if (timer)
            clearTimeout(timer);
        controller.abort(originalSignal?.reason);
    };
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
    return {
        signal: controller.signal,
        clear: () => {
            if (timer)
                clearTimeout(timer);
            if (originalSignal) {
                originalSignal.removeEventListener('abort', onOriginalAbort);
            }
        },
    };
}
/**
 * Check if an error is a transient network error that can be retried.
 * AbortError (user-cancelled) and TimeoutError are NOT retried.
 */
function isRecoverableNetworkError(err) {
    const msg = (err?.message || '').toLowerCase();
    const name = (err?.name || '').toLowerCase();
    // Never retry abort/timeout
    if (name === 'aborterror' || name === 'timeouterror' || msg.includes('abort') || msg.includes('timeout')) {
        return false;
    }
    // Retry on: fetch failed, ECONNRESET, ECONNREFUSED, ENOTFOUND, ETIMEDOUT, 5xx, DNS failures
    return msg.includes('fetch failed') ||
        msg.includes('econnreset') ||
        msg.includes('econnrefused') ||
        msg.includes('enotfound') ||
        msg.includes('etimedout') ||
        msg.includes('networkerror') ||
        msg.includes('network error') ||
        msg.includes('dns') ||
        msg.includes('eai_again') ||
        msg.includes('socket') ||
        msg.includes('endpoint') ||
        msg.includes('tls') ||
        msg.includes('ssl') ||
        msg.includes('certificate') ||
        msg.includes('unable to connect') ||
        msg.includes('could not connect');
}
/**
 * Fetch with automatic retry for transient network errors.
 * Uses exponential backoff: 1s, 2s, 4s between retries.
 * Only retries recoverable errors (network blips, DNS, ECONNREFUSED, etc.).
 * AbortError and TimeoutError are never retried.
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            // HTTP 5xx is retryable (server error)
            if (response.status >= 500 && attempt < maxRetries) {
                logger.warn(`[LLM] HTTP ${response.status} on attempt ${attempt + 1}/${maxRetries + 1}, retrying...`);
                await sleep(Math.pow(2, attempt) * 1000);
                continue;
            }
            return response;
        }
        catch (err) {
            lastError = err;
            if (!isRecoverableNetworkError(err) || attempt >= maxRetries) {
                throw err; // Not recoverable or out of retries
            }
            const delay = Math.pow(2, attempt) * 1000;
            logger.warn(`[LLM] Fetch failed on attempt ${attempt + 1}/${maxRetries + 1}: ${err.message}. Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
    throw lastError;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function parseTextToolCalls(text) {
    const results = [];
    let counter = 0;
    // Pattern 1: DeepSeek special tokens (old format)
    const deepseekTokenPattern = /<｜tool▁call▁begin｜>function<｜tool▁sep｜>(\w+)\n([\s\S]*?)<｜tool▁call▁end｜>/g;
    let match;
    while ((match = deepseekTokenPattern.exec(text)) !== null) {
        const name = match[1];
        const argsStr = match[2].trim();
        results.push({
            id: `call_text_${Date.now()}_${counter++}`,
            name,
            args: argsStr,
        });
    }
    // Pattern 1b: DSML format (newer DeepSeek V4 models)
    if (results.length === 0) {
        const dsmlPattern = /<｜DSML｜>?tool_calls?\s*\n?\s*(\w+)\s*\n([\s\S]*?)(?:<｜|$)/g;
        while ((match = dsmlPattern.exec(text)) !== null) {
            const name = match[1];
            const argsStr = match[2].trim();
            if (name && argsStr) {
                results.push({
                    id: `call_text_${Date.now()}_${counter++}`,
                    name,
                    args: argsStr,
                });
            }
        }
    }
    // Pattern 2: <tool_call> tags
    if (results.length === 0) {
        const toolCallTagPattern = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
        while ((match = toolCallTagPattern.exec(text)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                if (parsed.name) {
                    results.push({
                        id: `call_text_${Date.now()}_${counter++}`,
                        name: parsed.name,
                        args: typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments || {}),
                    });
                }
            }
            catch {
                // Invalid JSON, skip
            }
        }
    }
    // Pattern 3: JSON code blocks with tool/name field (prompt-guided fallback)
    if (results.length === 0) {
        const jsonBlockPattern = /```(?:json)?\s*\n?\s*(\{[\s\S]*?\})\s*\n?\s*```/g;
        while ((match = jsonBlockPattern.exec(text)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                const name = parsed.tool || parsed.name || parsed.function;
                if (name && typeof name === 'string') {
                    const args = parsed.arguments || parsed.params || parsed.parameters || {};
                    results.push({
                        id: `call_text_${Date.now()}_${counter++}`,
                        name,
                        args: typeof args === 'string' ? args : JSON.stringify(args),
                    });
                }
            }
            catch {
                // Invalid JSON, skip
            }
        }
    }
    return results;
}
export class OpenAIProvider {
    name = 'openai';
    model;
    apiKey;
    baseUrl;
    sendStreamOptions;
    /** Known vision-capable model name fragments */
    static VISION_MODELS = [
        'gpt-4o', 'gpt-4-turbo', 'gpt-4-vision', 'gpt-4o-mini',
        'deepseek-v4-pro', 'deepseek-v4-flash',
        'kimi-k2', 'moonshot-v1',
        'qwen-vl', 'qwen2-vl', 'qwen2.5-vl',
        'glm-4v',
        'claude',
    ];
    /**
     * Whether the current model likely supports image_url content blocks.
     * Conservative: only known vision models return true. Unknown models return false
     * to avoid sending image_url to APIs that don't understand it.
     */
    get supportsVision() {
        return OpenAIProvider.VISION_MODELS.some(m => this.model.includes(m));
    }
    constructor(options) {
        this.model = options.model;
        this.apiKey = options.apiKey;
        this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
        // Only send stream_options for native OpenAI API (default URL)
        this.sendStreamOptions = options.sendStreamOptions ?? (this.baseUrl === 'https://api.openai.com/v1');
    }
    async *chat(request) {
        const messages = this.convertMessages(request.messages, request.systemPrompt);
        const tools = request.tools ? this.convertTools(request.tools) : undefined;
        // Detect DeepSeek provider for special handling
        const isDeepSeek = this.baseUrl.includes('deepseek');
        const isReasonerModel = this.model.includes('reasoner');
        // Detect GLM / Zhipu provider for thinking-mode support
        const isGLM = this.baseUrl.includes('bigmodel');
        const isThinkingModel = this.model.includes('glm-5.1') || this.model.includes('glm-5');
        // DeepSeek with tools: use non-streaming mode for reliable tool calling.
        // DeepSeek's streaming mode has known issues with tool_calls:
        // 1. Tool call tokens sometimes leak into the content field as special markers
        // 2. The model may describe actions in text instead of populating tool_calls
        // 3. DeepSeek's official function calling examples use non-streaming mode
        // Non-streaming ensures the complete response (including tool_calls) is returned atomically.
        const useDeepSeekNonStreaming = isDeepSeek && !isReasonerModel && tools && tools.length > 0;
        if (useDeepSeekNonStreaming) {
            yield* this.deepSeekNonStreamingToolCall(messages, tools, request, isReasonerModel);
            return;
        }
        const _llmTimeout = signalWithTimeout(request.signal, DEFAULT_LLM_TIMEOUT);
        const body = {
            model: this.model,
            messages,
            stream: true,
        };
        // stream_options is OpenAI-specific; many compatible providers reject it
        if (this.sendStreamOptions) {
            body.stream_options = { include_usage: true };
        }
        if (tools && tools.length > 0 && !isReasonerModel) {
            body.tools = tools;
            // Set tool_choice: explicit value takes priority, otherwise default to "auto"
            // for compatible providers to ensure they know tools are available
            if (request.toolChoice) {
                body.tool_choice = request.toolChoice;
            }
            else if (!this.sendStreamOptions) {
                // For compatible providers (DeepSeek, GLM, etc.), explicitly send "auto"
                // to ensure the model knows it should consider using tools
                body.tool_choice = 'auto';
            }
            // parallel_tool_calls is OpenAI-specific — only set for native OpenAI
            if (this.sendStreamOptions) {
                body.parallel_tool_calls = false;
            }
        }
        if (request.maxTokens) {
            body.max_tokens = request.maxTokens;
        }
        // GLM thinking mode: add thinking parameter for models that support it
        if (isGLM && isThinkingModel) {
            body.thinking = { type: 'enabled' };
        }
        if (request.temperature !== undefined) {
            // OpenAI supports 0-2, but most compatible providers only support 0-1
            const maxTemp = this.sendStreamOptions ? 2 : 1;
            let temp = Math.min(Math.max(request.temperature, 0), maxTemp);
            // For compatible providers (non-native OpenAI), cap temperature lower when tools
            // are present to improve tool calling reliability
            if (!this.sendStreamOptions && tools && tools.length > 0) {
                temp = Math.min(temp, 0.7);
            }
            // DeepSeek reasoner models have fixed temperature — don't override
            if (this.model.includes('reasoner')) {
                delete body.temperature;
            }
            else {
                body.temperature = temp;
            }
        }
        const toolNames = tools ? tools.map(t => t.function.name) : [];
        logger.info(`[LLM] model=${this.model}, msgs=${messages.length}, tools=${toolNames.length}${toolNames.length > 0 ? ` [${toolNames.join(', ')}]` : ''}, temp=${body.temperature ?? 'default'}, toolChoice=${body.tool_choice ?? 'none'}, baseUrl=${this.baseUrl}`);
        const response = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: _llmTimeout.signal,
        });
        if (!response.ok) {
            const errorBody = await response.text();
            const errorText = errorBody.slice(0, 500);
            // Auto-retry with fewer parameters if the model doesn't support certain options
            if (response.status === 400 && typeof errorBody === 'string') {
                let retried = false;
                // Try removing parallel_tool_calls first (many providers don't support it)
                if (body.parallel_tool_calls !== undefined) {
                    logger.warn(`[LLM] model ${this.model} may not support parallel_tool_calls, retrying without it`);
                    delete body.parallel_tool_calls;
                    retried = true;
                }
                // Try removing tool_choice next
                if (body.tool_choice !== undefined &&
                    (errorBody.includes('tool_choice') || errorBody.includes('function call') || errorBody.includes('tool_choice'))) {
                    logger.warn(`[LLM] model ${this.model} does not support tool_choice, retrying without it`);
                    delete body.tool_choice;
                    retried = true;
                }
                // Try removing temperature (e.g. deepseek-reasoner has fixed temperature)
                if (body.temperature !== undefined &&
                    (errorBody.includes('temperature') || errorBody.includes('Temperature'))) {
                    logger.warn(`[LLM] model ${this.model} does not support custom temperature, retrying without it`);
                    delete body.temperature;
                    retried = true;
                }
                // Try stripping image_url blocks (many providers/models don't support vision)
                if (errorBody.includes('image_url')) {
                    logger.warn(`[LLM] model ${this.model} does not support image_url content, retrying with images stripped`);
                    const msgs = body.messages;
                    for (let i = 0; i < msgs.length; i++) {
                        const content = msgs[i].content;
                        if (Array.isArray(content)) {
                            const textBlocks = content.filter((b) => b.type !== 'image_url');
                            if (textBlocks.length === 0) {
                                // All content was images — replace with placeholder
                                msgs[i].content = '[图片已附加，但当前模型不支持图片识别]';
                            }
                            else if (textBlocks.length === 1 && textBlocks[0].type === 'text') {
                                // Single text block remaining — flatten to string for max compatibility
                                msgs[i].content = textBlocks[0].text || '';
                            }
                            else {
                                msgs[i].content = textBlocks;
                            }
                        }
                    }
                    retried = true;
                }
                if (retried) {
                    const retryResponse = await fetch(`${this.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.apiKey}`,
                        },
                        body: JSON.stringify(body),
                        signal: _llmTimeout.signal,
                    });
                    if (retryResponse.ok && retryResponse.body) {
                        logger.info(`[LLM] Retry succeeded`);
                        // Stream the response (with tool handling)
                        let syntheticIdCounterRetry = 0;
                        const toolCallBuffersRetry = new Map();
                        let sseEventCountRetry = 0;
                        let hadToolCallsRetry = false;
                        let accumulatedTextRetry = '';
                        let lastFinishReasonRetry = null;
                        for await (const sseEvent of parseSSEStream(retryResponse.body, request.signal)) {
                            sseEventCountRetry++;
                            let data;
                            try {
                                data = JSON.parse(sseEvent.data);
                            }
                            catch {
                                continue;
                            }
                            if (data.usage) {
                                const usage = data.usage;
                                yield { type: 'usage', inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
                                continue;
                            }
                            const choices = data.choices;
                            if (!choices?.[0])
                                continue;
                            const delta = choices[0].delta;
                            if (delta?.reasoning_content) {
                                yield { type: 'reasoning_delta', text: delta.reasoning_content };
                            }
                            if (delta?.content) {
                                accumulatedTextRetry += delta.content;
                                yield { type: 'text_delta', text: delta.content };
                            }
                            if (delta?.tool_calls) {
                                hadToolCallsRetry = true;
                                for (const tc of delta.tool_calls) {
                                    const idx = tc.index ?? 0;
                                    if (!toolCallBuffersRetry.has(idx)) {
                                        const id = tc.id || `call_${Date.now()}_${syntheticIdCounterRetry++}`;
                                        toolCallBuffersRetry.set(idx, { id, name: tc.function?.name || '', args: '', started: false });
                                    }
                                    const buf = toolCallBuffersRetry.get(idx);
                                    if (tc.id && buf.id.startsWith('call_'))
                                        buf.id = tc.id;
                                    if (tc.function?.name && !buf.name)
                                        buf.name = tc.function.name;
                                    if (!buf.started && buf.name) {
                                        buf.started = true;
                                        yield { type: 'tool_call_start', id: buf.id, name: buf.name };
                                    }
                                    if (tc.function?.arguments) {
                                        buf.args += tc.function.arguments;
                                        if (buf.started)
                                            yield { type: 'tool_call_delta', id: buf.id, args: tc.function.arguments };
                                    }
                                }
                            }
                            if (choices[0].finish_reason) {
                                lastFinishReasonRetry = choices[0].finish_reason;
                                for (const [, buf] of toolCallBuffersRetry) {
                                    if (!buf.started && buf.name)
                                        yield { type: 'tool_call_start', id: buf.id, name: buf.name };
                                    if (buf.name)
                                        yield { type: 'tool_call_end', id: buf.id };
                                }
                                toolCallBuffersRetry.clear();
                            }
                        }
                        // Post-processing for text-based tool calls (same as main path)
                        if (!hadToolCallsRetry && accumulatedTextRetry) {
                            const textToolCalls = parseTextToolCalls(accumulatedTextRetry);
                            if (textToolCalls.length > 0) {
                                logger.info(`[LLM] Retry: Detected ${textToolCalls.length} text-based tool call(s)`);
                                for (const tc of textToolCalls) {
                                    yield { type: 'tool_call_start', id: tc.id, name: tc.name };
                                    if (tc.args)
                                        yield { type: 'tool_call_delta', id: tc.id, args: tc.args };
                                    yield { type: 'tool_call_end', id: tc.id };
                                }
                            }
                        }
                        yield { type: 'done', finishReason: lastFinishReasonRetry };
                        _llmTimeout.clear();
                        return;
                    }
                }
            }
            // Provide user-friendly error messages for common HTTP status codes
            let userMessage = `API 请求失败 (${response.status}): ${errorText}`;
            if (response.status === 401) {
                userMessage = `API Key 无效或已过期 (401 Unauthorized)。

请检查：
1. API Key 是否正确（注意不要有多余的空格）
2. API Key 是否已过期或被吊销
3. 如果是浙江金默 (jinmo) 服务，请联系管理员确认账号状态

当前 Base URL: ${this.baseUrl}

原始错误: ${errorBody}`;
            }
            else if (response.status === 403) {
                userMessage = `API 访问被拒绝 (403 Forbidden)。

可能原因：
1. API Key 权限不足
2. IP 地址被限制
3. 账号未激活或欠费

原始错误: ${errorBody}`;
            }
            else if (response.status === 429) {
                userMessage = `请求频率超限 (429 Too Many Requests)，请稍后重试。

原始错误: ${errorBody}`;
            }
            throw new Error(userMessage);
        }
        if (!response.body) {
            throw new Error('No response body from OpenAI');
        }
        // Track in-progress tool calls for delta assembly
        // Keyed by index (or 0 for providers that omit index)
        let syntheticIdCounter = 0;
        const toolCallBuffers = new Map();
        let hadToolCalls = false; // Track if any tool calls were received via API
        let accumulatedText = ''; // Accumulate text for post-processing (DeepSeek text-based tool call detection)
        let lastFinishReason = null; // Track finish_reason for truncation detection
        // Diagnostic: log raw SSE events to understand provider behavior
        let sseEventCount = 0;
        for await (const sseEvent of parseSSEStream(response.body, request.signal)) {
            sseEventCount++;
            let data;
            try {
                data = JSON.parse(sseEvent.data);
            }
            catch {
                logger.warn(`[LLM] SSE event #${sseEventCount}: failed to parse JSON:`, sseEvent.data.slice(0, 200));
                continue;
            }
            // Log first 3 events and any events that mention tools/functions for diagnostics
            if (sseEventCount <= 3 || sseEvent.data.includes('tool_calls') || sseEvent.data.includes('function_call')) {
                logger.info(`[LLM] SSE #${sseEventCount}: ${sseEvent.data.slice(0, 300)}`);
            }
            // Handle usage info
            if (data.usage) {
                const usage = data.usage;
                yield {
                    type: 'usage',
                    inputTokens: usage.prompt_tokens,
                    outputTokens: usage.completion_tokens,
                };
                continue;
            }
            const choices = data.choices;
            if (!choices || choices.length === 0)
                continue;
            const choice = choices[0];
            const delta = choice.delta;
            // DeepSeek reasoning_content (R1, V3 thinking mode)
            if (delta?.reasoning_content) {
                yield { type: 'reasoning_delta', text: delta.reasoning_content };
            }
            // Text content
            if (delta?.content) {
                accumulatedText += delta.content;
                yield { type: 'text_delta', text: delta.content };
            }
            // Tool calls (streamed incrementally via delta)
            // Compatible with providers that may omit id/index fields (e.g. GLM)
            if (delta?.tool_calls) {
                hadToolCalls = true;
                for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallBuffers.has(idx)) {
                        // New tool call - generate synthetic ID if provider doesn't supply one
                        const id = tc.id || `call_${Date.now()}_${syntheticIdCounter++}`;
                        const name = tc.function?.name || '';
                        toolCallBuffers.set(idx, { id, name, args: '', started: false });
                    }
                    else {
                        // Update id/name if they arrive in a later chunk
                        const buf = toolCallBuffers.get(idx);
                        if (tc.id && buf.id.startsWith('call_'))
                            buf.id = tc.id;
                        if (tc.function?.name && !buf.name)
                            buf.name = tc.function.name;
                    }
                    const buf = toolCallBuffers.get(idx);
                    // Emit tool_call_start once we know the name
                    if (!buf.started && buf.name) {
                        buf.started = true;
                        yield { type: 'tool_call_start', id: buf.id, name: buf.name };
                    }
                    if (tc.function?.arguments) {
                        buf.args += tc.function.arguments;
                        if (buf.started) {
                            yield { type: 'tool_call_delta', id: buf.id, args: tc.function.arguments };
                        }
                    }
                }
            }
            // Legacy function_call format in delta (used by some older compatible providers)
            if (delta?.function_call) {
                hadToolCalls = true;
                const idx = 0;
                if (!toolCallBuffers.has(idx)) {
                    const id = `call_${Date.now()}_${syntheticIdCounter++}`;
                    const name = delta.function_call.name || '';
                    toolCallBuffers.set(idx, { id, name, args: '', started: false });
                    logger.info(`[LLM] Detected legacy function_call format: ${name}`);
                }
                const buf = toolCallBuffers.get(idx);
                if (delta.function_call.name && !buf.name) {
                    buf.name = delta.function_call.name;
                }
                if (!buf.started && buf.name) {
                    buf.started = true;
                    yield { type: 'tool_call_start', id: buf.id, name: buf.name };
                }
                if (delta.function_call.arguments) {
                    buf.args += delta.function_call.arguments;
                    if (buf.started) {
                        yield { type: 'tool_call_delta', id: buf.id, args: delta.function_call.arguments };
                    }
                }
            }
            // Some providers return complete tool_calls in message (non-delta) within streaming chunks
            if (choice.message?.tool_calls) {
                hadToolCalls = true;
                for (const tc of choice.message.tool_calls) {
                    const id = tc.id || `call_${Date.now()}_${syntheticIdCounter++}`;
                    const name = tc.function.name;
                    const args = tc.function.arguments;
                    yield { type: 'tool_call_start', id, name };
                    if (args)
                        yield { type: 'tool_call_delta', id, args };
                    yield { type: 'tool_call_end', id };
                }
            }
            // Legacy function_call in complete message
            if (choice.message?.function_call) {
                hadToolCalls = true;
                const id = `call_${Date.now()}_${syntheticIdCounter++}`;
                const name = choice.message.function_call.name;
                const args = choice.message.function_call.arguments;
                logger.info(`[LLM] Detected legacy function_call in message: ${name}`);
                yield { type: 'tool_call_start', id, name };
                if (args)
                    yield { type: 'tool_call_delta', id, args };
                yield { type: 'tool_call_end', id };
            }
            // Check finish reason - emit tool_call_end for all buffered delta tool calls
            if (choice.finish_reason) {
                lastFinishReason = choice.finish_reason;
                logger.info(`[LLM] finish_reason: ${choice.finish_reason}, buffered tool calls: ${toolCallBuffers.size}, total SSE events: ${sseEventCount}`);
                for (const [, buf] of toolCallBuffers) {
                    if (!buf.started && buf.name) {
                        yield { type: 'tool_call_start', id: buf.id, name: buf.name };
                    }
                    if (buf.name) {
                        yield { type: 'tool_call_end', id: buf.id };
                    }
                }
                toolCallBuffers.clear();
            }
        }
        logger.info(`[LLM] Stream complete. Total SSE events: ${sseEventCount}, hadToolCalls: ${hadToolCalls}`);
        // Post-processing: detect tool calls embedded in text content.
        // DeepSeek sometimes leaks raw tool-calling tokens into the content field
        // instead of populating the tool_calls array properly.
        if (!hadToolCalls && accumulatedText) {
            const textToolCalls = parseTextToolCalls(accumulatedText);
            if (textToolCalls.length > 0) {
                logger.info(`[LLM] Detected ${textToolCalls.length} text-based tool call(s) from response content`);
                for (const tc of textToolCalls) {
                    yield { type: 'tool_call_start', id: tc.id, name: tc.name };
                    if (tc.args)
                        yield { type: 'tool_call_delta', id: tc.id, args: tc.args };
                    yield { type: 'tool_call_end', id: tc.id };
                }
            }
        }
        yield { type: 'done', finishReason: lastFinishReason };
        _llmTimeout.clear();
    }
    /**
     * DeepSeek non-streaming tool call path.
     * Uses a single non-streaming request to ensure tool_calls are returned atomically,
     * bypassing streaming issues where tool calls leak into content as special markers.
     */
    async *deepSeekNonStreamingToolCall(messages, tools, request, isReasonerModel) {
        const _llmTimeoutDs = signalWithTimeout(request.signal, DEFAULT_LLM_TIMEOUT);
        const body = {
            model: this.model,
            messages,
            stream: false,
            tools,
            tool_choice: request.toolChoice || 'auto',
        };
        if (request.maxTokens) {
            body.max_tokens = request.maxTokens;
        }
        if (request.temperature !== undefined) {
            // Lower temperature for more reliable tool calling
            let temp = Math.min(Math.max(request.temperature, 0), 1);
            temp = Math.min(temp, 0.3);
            body.temperature = temp;
        }
        const toolNames = tools.map(t => t.function.name);
        logger.info(`[LLM] DeepSeek non-streaming tool call: model=${this.model}, msgs=${messages.length}, tools=${toolNames.length} [${toolNames.join(', ')}], toolChoice=${body.tool_choice}, temp=${body.temperature ?? 'default'}`);
        const response = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
            signal: _llmTimeoutDs.signal,
        });
        if (!response.ok) {
            const errorBody = await response.text();
            // Auto-retry: if tool_choice or other params are rejected, retry without them
            if (response.status === 400) {
                let modified = false;
                if (body.tool_choice !== undefined && (errorBody.includes('tool_choice') || errorBody.includes('function'))) {
                    logger.warn(`[LLM] DeepSeek rejected tool_choice, retrying without it`);
                    delete body.tool_choice;
                    modified = true;
                }
                if (body.temperature !== undefined && (errorBody.includes('temperature') || errorBody.includes('Temperature'))) {
                    logger.warn(`[LLM] DeepSeek rejected temperature, retrying without it`);
                    delete body.temperature;
                    modified = true;
                }
                // Strip image_url blocks if provider doesn't support vision
                if (errorBody.includes('image_url')) {
                    logger.warn(`[LLM] model ${this.model} does not support image_url content, retrying with images stripped`);
                    const msgs = body.messages;
                    for (let i = 0; i < msgs.length; i++) {
                        const content = msgs[i].content;
                        if (Array.isArray(content)) {
                            const textBlocks = content.filter((b) => b.type !== 'image_url');
                            if (textBlocks.length === 0) {
                                msgs[i].content = '[图片已附加，但当前模型不支持图片识别]';
                            }
                            else if (textBlocks.length === 1 && textBlocks[0].type === 'text') {
                                msgs[i].content = textBlocks[0].text || '';
                            }
                            else {
                                msgs[i].content = textBlocks;
                            }
                        }
                    }
                    modified = true;
                }
                if (modified) {
                    const retryResp = await fetch(`${this.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.apiKey}`,
                        },
                        body: JSON.stringify(body),
                        signal: _llmTimeoutDs.signal,
                    });
                    if (retryResp.ok) {
                        yield* this.parseNonStreamingResponse(await retryResp.json());
                        _llmTimeoutDs.clear();
                        return;
                    }
                }
            }
            const errorText = errorBody.slice(0, 500);
            let userMessage = `API 请求失败 (${response.status}): ${errorText}`;
            if (response.status === 401) {
                userMessage = `API Key 无效或已过期 (401)。请检查 API Key 和 Base URL: ${this.baseUrl}\n\n原始错误: ${errorBody}`;
            }
            else if (response.status === 429) {
                userMessage = `请求频率超限 (429)，请稍后重试。\n\n原始错误: ${errorBody}`;
            }
            throw new Error(userMessage);
        }
        const data = await response.json();
        yield* this.parseNonStreamingResponse(data);
        _llmTimeoutDs.clear();
    }
    /**
     * Parse a complete (non-streaming) chat completion response into StreamEvents.
     */
    async *parseNonStreamingResponse(data) {
        const choices = data.choices;
        const choice = choices?.[0];
        if (!choice?.message) {
            logger.warn(`[LLM] DeepSeek non-streaming: no valid choice in response`);
            yield { type: 'done' };
            return;
        }
        const message = choice.message;
        let hadToolCalls = false;
        // Emit reasoning content (DeepSeek R1/V3 thinking mode)
        if (message.reasoning_content) {
            yield { type: 'reasoning_delta', text: message.reasoning_content };
        }
        // Emit text content
        if (message.content) {
            yield { type: 'text_delta', text: message.content };
        }
        // Emit native tool_calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            hadToolCalls = true;
            logger.info(`[LLM] DeepSeek non-streaming: received ${message.tool_calls.length} native tool call(s)`);
            for (const tc of message.tool_calls) {
                const id = tc.id || `call_ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const name = tc.function?.name || 'unknown';
                const args = tc.function?.arguments || '{}';
                yield { type: 'tool_call_start', id, name };
                yield { type: 'tool_call_delta', id, args };
                yield { type: 'tool_call_end', id };
            }
        }
        // Legacy function_call format
        if (!hadToolCalls && message.function_call) {
            hadToolCalls = true;
            const id = `call_ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const name = message.function_call.name;
            const args = message.function_call.arguments;
            logger.info(`[LLM] DeepSeek non-streaming: detected legacy function_call: ${name}`);
            yield { type: 'tool_call_start', id, name };
            if (args)
                yield { type: 'tool_call_delta', id, args };
            yield { type: 'tool_call_end', id };
        }
        // Fallback: parse text for embedded tool calls (special tokens, tags, JSON blocks)
        if (!hadToolCalls && message.content) {
            const textToolCalls = parseTextToolCalls(message.content);
            if (textToolCalls.length > 0) {
                logger.info(`[LLM] DeepSeek non-streaming: detected ${textToolCalls.length} text-based tool call(s)`);
                for (const tc of textToolCalls) {
                    yield { type: 'tool_call_start', id: tc.id, name: tc.name };
                    if (tc.args)
                        yield { type: 'tool_call_delta', id: tc.id, args: tc.args };
                    yield { type: 'tool_call_end', id: tc.id };
                }
            }
        }
        // Emit usage
        if (data.usage) {
            const usage = data.usage;
            yield { type: 'usage', inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens };
        }
        logger.info(`[LLM] DeepSeek non-streaming complete. hadToolCalls=${hadToolCalls}, finish_reason=${choice.finish_reason}`);
        yield { type: 'done', finishReason: choice.finish_reason || null };
    }
    convertMessages(messages, systemPrompt) {
        const result = [];
        if (systemPrompt) {
            result.push({ role: 'system', content: systemPrompt });
        }
        // Track tool calls from assistant messages and their corresponding responses
        const pendingToolCalls = new Set();
        for (const msg of messages) {
            switch (msg.role) {
                case 'user':
                    // Ensure content is never null/undefined - some providers (like 浙江金默) require it
                    if (Array.isArray(msg.content)) {
                        // Multi-modal: ContentBlock[] — convert to OpenAI vision content array
                        const openaiBlocks = msg.content.map(block => {
                            if (block.type === 'text') {
                                return { type: 'text', text: block.text };
                            }
                            if (block.type === 'image') {
                                if (this.supportsVision) {
                                    return {
                                        type: 'image_url',
                                        image_url: {
                                            url: 'data:' + block.mediaType + ';base64,' + block.data,
                                            detail: 'auto',
                                        },
                                    };
                                }
                                // Model doesn't support vision — drop image, keep text only
                                return null;
                            }
                            return { type: 'text', text: '' };
                        }).filter((b) => b !== null);
                        // If all blocks were images (now stripped), use placeholder text
                        if (openaiBlocks.length === 0) {
                            result.push({ role: 'user', content: '[图片已附加，但当前模型不支持图片识别]' });
                        }
                        else if (openaiBlocks.length === 1 && openaiBlocks[0].type === 'text') {
                            // Single text block — flatten to string for max compatibility
                            result.push({ role: 'user', content: openaiBlocks[0].text || '' });
                        }
                        else {
                            result.push({ role: 'user', content: openaiBlocks });
                        }
                    }
                    else {
                        result.push({ role: 'user', content: msg.content || '' });
                    }
                    break;
                case 'assistant': {
                    const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
                    const openaiMsg = {
                        role: 'assistant',
                        // When tool_calls are present, content should be null (standard OpenAI format).
                        // When no tool_calls, use empty string to prevent nil errors on strict providers.
                        content: msg.content || (hasToolCalls ? null : ''),
                    };
                    // DeepSeek thinking mode: ALWAYS include reasoning_content for assistant messages.
                    // The API requires this field when the model uses thinking mode, even if empty.
                    // Without it, the API returns 400: "reasoning_content must be passed back"
                    if (this.baseUrl.includes('deepseek')) {
                        const rc = ('reasoningContent' in msg && msg.reasoningContent) ? msg.reasoningContent : '';
                        openaiMsg.reasoning_content = rc;
                    }
                    if (hasToolCalls) {
                        openaiMsg.tool_calls = msg.toolCalls.map((tc) => ({
                            id: tc.id,
                            type: 'function',
                            function: {
                                name: tc.name,
                                arguments: JSON.stringify(tc.arguments),
                            },
                        }));
                        // Track pending tool calls
                        for (const tc of msg.toolCalls) {
                            pendingToolCalls.add(tc.id);
                        }
                    }
                    result.push(openaiMsg);
                    break;
                }
                case 'tool':
                    // Ensure content is never null/undefined
                    result.push({
                        role: 'tool',
                        content: msg.content || '',
                        tool_call_id: msg.toolCallId,
                    });
                    // Mark tool call as responded
                    pendingToolCalls.delete(msg.toolCallId);
                    break;
            }
        }
        // Final validation: handle pending tool calls without responses
        // If there are assistant messages with tool_calls but no corresponding tool messages,
        // we need to add placeholder tool responses to satisfy the API format.
        if (pendingToolCalls.size > 0) {
            logger.warn(`[LLM] Found ${pendingToolCalls.size} pending tool calls without responses: ${Array.from(pendingToolCalls).join(', ')}`);
            // First pass: try to fix empty toolCallId by positional matching.
            // When tool messages have empty tool_call_id (e.g. from old DB records),
            // match them to the preceding assistant's tool_calls by position.
            for (let i = 0; i < result.length; i++) {
                const msg = result[i];
                if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
                    // Collect the following tool messages
                    const toolMsgs = [];
                    for (let j = i + 1; j < result.length && result[j].role === 'tool'; j++) {
                        toolMsgs.push(result[j]);
                    }
                    // Positional match: if a tool message has empty/missing tool_call_id, assign it
                    for (let k = 0; k < Math.min(msg.tool_calls.length, toolMsgs.length); k++) {
                        const tm = toolMsgs[k];
                        if (!tm.tool_call_id || !pendingToolCalls.has(msg.tool_calls[k].id) === false) {
                            // If the tool message has no ID, or has an ID that doesn't match anything
                            if (!tm.tool_call_id || tm.tool_call_id === '') {
                                const correctId = msg.tool_calls[k].id;
                                logger.info(`[LLM] Fixing empty tool_call_id → ${correctId} by positional match`);
                                tm.tool_call_id = correctId;
                                pendingToolCalls.delete(correctId);
                            }
                        }
                    }
                }
            }
            // Second pass: for any still-pending tool calls, add synthetic tool responses
            if (pendingToolCalls.size > 0) {
                logger.info(`[LLM] Adding synthetic tool responses for ${pendingToolCalls.size} orphaned tool calls`);
                for (let i = result.length - 1; i >= 0; i--) {
                    const msg = result[i];
                    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
                        const orphanedCalls = msg.tool_calls.filter(tc => pendingToolCalls.has(tc.id));
                        if (orphanedCalls.length > 0) {
                            // Find insertion point: right after the last existing tool response for this assistant message,
                            // or right after the assistant message itself
                            let insertAt = i + 1;
                            while (insertAt < result.length && result[insertAt].role === 'tool') {
                                insertAt++;
                            }
                            // Add synthetic responses for orphaned calls
                            for (const tc of orphanedCalls) {
                                result.splice(insertAt, 0, {
                                    role: 'tool',
                                    tool_call_id: tc.id,
                                    content: `[Tool "${tc.function.name}" was not executed - task was paused or interrupted before completion]`,
                                });
                                pendingToolCalls.delete(tc.id);
                                insertAt++;
                            }
                        }
                    }
                }
            }
        }
        // Final validation: ensure no message has undefined content
        // Some providers (like 浙江金默) strictly require the content field
        // But allow null for assistant messages with tool_calls (standard OpenAI format)
        for (const msg of result) {
            if (msg.content === undefined || msg.content === null) {
                // Allow null content for assistant messages with tool_calls
                if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0)
                    continue;
                // Only fix if it's not a tool message (tool messages must have content)
                if (msg.role !== 'tool') {
                    msg.content = '';
                }
            }
        }
        return result;
    }
    convertTools(tools) {
        return tools.map((t) => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters,
            },
        }));
    }
}
//# sourceMappingURL=openai.js.map