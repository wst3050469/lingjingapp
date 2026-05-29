// Core Agent - the agentic loop that orchestrates LLM + tool calling
import { Conversation } from './conversation.js';
import { ToolExecutor } from '../tools/executor.js';
import { logger } from '../utils/logger.js';
import { SkillHarvester } from '../skills/harvester.js';
import { MemoryNudger } from '../memory/nudger.js';
import { MemoryReflector } from '../memory/reflector.js';
import { TaskComplexityAnalyzer } from '../workflow/task-complexity-analyzer.js';
/**
 * Appended to the system prompt when tools are available.
 * Reinforces that the model should use function calling instead of describing actions.
 */
const TOOL_USE_REINFORCEMENT = `

## Tool Calling (CRITICAL)

When you need to perform an action — such as running a command, reading a file, searching code, or making edits — you MUST use the provided function calling mechanism (tool_calls). Do NOT simply describe what you would do in text. For example:
- To run a shell command, call the \`bash\` tool — never just say "I'll run the command"
- To read a file, call the \`file_read\` tool — never just say "Let me look at the file"
- To search for code, call the \`grep\` or \`glob\` tool

Always take action by calling tools. Your text responses should only contain analysis, explanations, or summaries — never descriptions of actions you intend to take without actually calling the tool.`;
/**
 * Injected as a user message when the model described an action without calling any tools.
 * Gives the model one chance to correct its behavior.
 */
const TOOL_NUDGE_MESSAGE = `You described actions in your response but did not call any tools. Please use the function calling mechanism (tool_calls) to actually perform the actions. Do not describe what you would do — call the appropriate tool now.`;
/**
 * System prompt for the auto-compaction summarizer.
 */
const COMPACTION_SYSTEM_PROMPT = `You are a conversation compression engine. Summarize the following conversation between a user and an AI coding assistant.
Preserve: (1) Key technical decisions, (2) File paths and code references, (3) Current task state (done vs pending), (4) Errors encountered and resolutions, (5) User preferences.
Remove: Redundant dialogue, verbose tool output details, intermediate reasoning.
Output a concise structured summary in the SAME LANGUAGE as the conversation. Keep under 1500 tokens.`;
/**
 * Maximum context window size used for compaction threshold calculation.
 * For models with huge context windows (e.g. deepseek-v4-pro at 1M tokens),
 * we cap the compaction threshold so auto-compaction still triggers at
 * reasonable conversation sizes instead of being practically disabled.
 */
const COMPACTION_MAX_CONTEXT = 200000;
/**
 * Detect whether text contains phrases suggesting the model intended to use tools
 * but instead described the action in text.
 * Uses flexible patterns that allow filler words between subject and verb.
 */
function looksLikeToolIntent(text) {
    if (!text || text.length < 10)
        return false;
    const ACTION_VERBS_EN = '(?:check|runn?|execut|read|search|look|find|creat|writ|open|examin|inspect|analyz|scan|list|fetch|get|view|explor|start|begin|navigat|brows)\\w*';
    const ACTION_VERBS_ZH = '(?:查看|检查|执行|运行|读取|搜索|查找|创建|写入|打开|分析|扫描|获取|浏览|探索|看看|看一下|确认|了解)';
    const patterns = [
        // English patterns — allow filler words (e.g. "I'll help you explore", "Let me start by checking")
        new RegExp(`I'll\\s+${ACTION_VERBS_EN}`, 'i'),
        new RegExp(`I'll\\s+\\w+\\s+\\w*\\s*${ACTION_VERBS_EN}`, 'i'),
        new RegExp(`I'm going to\\s+${ACTION_VERBS_EN}`, 'i'),
        new RegExp(`Let me\\s+${ACTION_VERBS_EN}`, 'i'),
        new RegExp(`Let me\\s+start`, 'i'),
        new RegExp(`I will\\s+${ACTION_VERBS_EN}`, 'i'),
        new RegExp(`I need to\\s+${ACTION_VERBS_EN}`, 'i'),
        // Chinese patterns — allow up to 6 chars between subject and verb for filler (帮您, 先, 来)
        new RegExp(`我.{0,6}${ACTION_VERBS_ZH}`),
        new RegExp(`让我.{0,6}${ACTION_VERBS_ZH}`),
        new RegExp(`首先.{0,4}${ACTION_VERBS_ZH}`),
        new RegExp(`我先.{0,4}${ACTION_VERBS_ZH}`),
    ];
    return patterns.some(p => p.test(text));
}
/**
 * Detect whether the text indicates task completion.
 * Used to decide whether to auto-continue when no tools were called.
 *
 * Strategy:
 * - Only match completion keywords at the END of a statement/sentence
 * - Skip matches that are followed by future/continuation context
 * - Short responses (< 3 chars) are NOT treated as done (prevents false positives)
 * - INCOMPLETE patterns override COMPLETION patterns
 */
function looksLikeTaskComplete(text) {
    if (!text)
        return true;
    if (text.length < 3)
        return false; // Too short to determine (e.g. "好的", "继续", "ok")
    const COMPLETION_PATTERNS = [
        // English completion indicators (must be at end of text or sentence-ending position)
        /(?:done|complete[dl]?|finished|success(?:fully)?)\s*[.!]*$/mi,
        /all\s+(?:tasks|steps)\s+(?:done|complete)\s*[.!]*$/mi,
        /^(?:great|perfect|all done|ok(?:ay)?)\s*[.!]*$/mi,
        // Chinese completion indicators — MUST appear at end of text (sentence/clause)
        // "已完成" at end → YES; "我会完成这个" → NO
        /已经完成[了。]?\s*$/,
        /任务完成[了。]?\s*$/,
        /全部完成[了。]?\s*$/,
        /已完成[了。]?\s*$/,
        /已成功[了。]?\s*$/,
        /全都搞定了?\s*[。！]?\s*$/,
        /做好了[。！]?\s*$/,
        /完成了[。！]?\s*$/,
        /处理完毕[。！]?\s*$/,
        /已处理[完]?[了。]?\s*$/,
        /执行完毕[。！]?\s*$/,
        /全部结束[。！]?\s*$/,
        // Summary-style completion (model summarizes what was done)
        /^(?:已完成|已成功|成功完成|顺利完成)[了。]?\s*$/m,
    ];
    const INCOMPLETE_PATTERNS = [
        // English incomplete indicators
        /\b(?:next|then|after that|now|continue|let's|we need to|we should|I'll|I will|I can|let me)\b/i,
        /\b(?:step \d+|phase \d+|part \d+)\b/i,
        /^to\s+(?:complete|finish|do)/im,
        /^(?:the\s+)?(?:remaining|next)\s+step/im,
        // Chinese incomplete indicators — any occurrence means NOT done
        /接下来/,
        /然后/,
        /继续/,
        /下一步/,
        /第[一二三四五六七八九十\d]+[步个环节阶段]/,
        /还需要/,
        /正在/,
        /即将/,
        /准备/,
        /将要/,
        /将要进行/,
        /现在[来就]/,
        /下面[来就]/,
        /开始/,
        // Future tense in Chinese — "我会..." "需要..." = task not done
        /[我需]会/,
        /需要[再要]?/,
        /还要/,
        /待会/,
        // Action-oriented patterns — model describing next actions
        /让我[们]?[来就]/,
        /我来/,
        // "完成" used as future/incomplete ("我会完成这个任务" → NOT done)
        /[会要需][将去].*完成/,
        /还没[有]?完成/,
        // Additional incomplete guards — text contains completion-looking
        // phrases AND continuation signals → definitely not done
        /已(?:完成|成功).*(?:接下来|然后|下一步|还需要|将要|即将|现在|准备|开始)/,
        /完成.*(?:接下来|然后|下一步|还需要|将要|即将|现在|准备|开始)/,
        // "已完成xxx" at beginning followed by any future action → not done
        /^(?:已经|已).{0,10}(?:完成|成功).{0,20}(?:接下来|然后|下一步|还需要|现在|准备|开始|让我|我来)/,
        // "功能开发已完成" or similar completion statement followed by deployment intent
        /(?:功能|任务|工作|开发|部署).{0,10}(?:完成|成功|结束).{0,20}(?:接下来|然后|下一步|现在|即将|准备|需要)/,
    ];
    const textLower = text.toLowerCase();
    // First, check for INCOMPLETE patterns — these override completion
    if (INCOMPLETE_PATTERNS.some(p => p.test(text) || p.test(textLower))) {
        return false;
    }
    // Then, check for explicit completion (at end of statement)
    if (COMPLETION_PATTERNS.some(p => p.test(text) || p.test(textLower))) {
        return true;
    }
    // Default: assume task is NOT complete unless explicitly indicated.
    // This prevents premature termination when the model gives a short
    // or ambiguous response (e.g. after conversation compression).
    return false;
}
export class Agent {
    /** @internal - public for cross-window hydration via IPC */
    conversation = new Conversation();
    executor;
    config;
    interventionQueue = [];
    harvester = null;
    nudger;
    reflector = null;
    runStartedAt = 0;
    workflowEngine = null;
    constructor(config) {
        this.config = {
            maxTurns: 500,
            maxDuration: 0, // no limit by default (config can override)
            turnTimeout: 600_000, // 10 minutes per turn
            maxContextTokens: 128000,
            maxResponseTokens: 4096,
            temperature: 0.3,
            ...config,
        };
        this.executor = new ToolExecutor(config.tools);
        this.harvester = config.enableSkillHarvest
            ? new SkillHarvester({ provider: config.provider })
            : null;
        this.nudger = new MemoryNudger({
            enabled: config.enableMemoryNudge !== false,
        });
        this.reflector = config.enableReflector
            ? new MemoryReflector({
                enabled: true,
                intervalMs: 24 * 60 * 60 * 1000, // 24h
                provider: config.provider,
            })
            : null;
        this.workflowEngine = config.workflowEngine || null;
    }
    /**
     * Inject a user intervention message into the agent loop.
     * The message will be picked up after the current tool execution batch completes.
     */
    injectIntervention(text) {
        this.interventionQueue.push(text);
    }
    emit(event) {
        this.config.onEvent?.(event);
    }
    /**
     * Run one complete interaction: take user input, loop through LLM + tools until done.
     * Returns the final text response.
     */
    async run(userMessage, signal, images) {
        // ── 工作流集成：分析任务复杂度 ──
        if (this.workflowEngine) {
            const complexity = TaskComplexityAnalyzer.analyze(userMessage);
            if (complexity.isComplex && complexity.confidence >= 0.7) {
                logger.info('[Agent] Complex task detected, creating workflow:', complexity.featureName);
                try {
                    const workflowId = await this.workflowEngine.startWorkflow({
                        featureName: complexity.featureName || '新功能',
                        projectPath: this.config.workingDirectory || process.cwd(),
                        requirement: userMessage,
                    });
                    // 通知前端工作流已创建
                    this.emit({
                        type: 'workflow_started',
                        workflowId,
                        featureName: complexity.featureName || '新功能',
                    });
                    // 添加提示到会话
                    const workflowMessage = `✓ 已创建工作流：${complexity.featureName}\n\n工作流ID: ${workflowId}\n\n工作流将自动执行以下阶段：\n1. 需求分析\n2. 设计\n3. 实现\n4. 验证\n\n您可以在工作流管理中查看实时进度。现在继续为您处理这个任务...\n\n---\n\n`;
                    // 继续正常处理，不要直接返回
                    this.conversation.addUserMessage(userMessage, images);
                }
                catch (error) {
                    logger.error('[Agent] Failed to create workflow:', error);
                    // 继续正常执行
                }
            }
        }
        this.conversation.addUserMessage(userMessage, images);
        // Memory nudge: remind agent to persist useful knowledge
        const nudgeMsg = this.nudger.review(this.conversation);
        if (nudgeMsg) {
            this.conversation.addUserMessage(nudgeMsg);
        }
        const abortSignal = signal ?? new AbortController().signal;
        // ★ Fix B: Guard against already-aborted input signals.
        // If the incoming signal is already aborted (e.g. from a previous run's
        // AbortController that was reused), create a fresh signal.
        if (abortSignal.aborted) {
            logger.warn('[Agent] Input signal already aborted, creating fresh signal');
        }
        const safeSignal = abortSignal.aborted ? new AbortController().signal : abortSignal;
        // Merge user abort signal + global wall-clock timeout into one controller
        const globalController = new AbortController();
        let globalTimer;
        if (this.config.maxDuration > 0) {
            globalTimer = setTimeout(() => {
                this.emit({ type: 'error', error: new Error(`Agent max duration (${Math.round(this.config.maxDuration / 60000)} min) reached`) });
                globalController.abort(new Error('Agent max duration reached'));
            }, this.config.maxDuration);
        }
        safeSignal.addEventListener('abort', () => globalController.abort(safeSignal.reason), { once: true });
        const mergedSignal = globalController.signal;
        // Heartbeat: send a pulse every 5 seconds so the renderer knows the agent is alive
        this.runStartedAt = Date.now();
        const heartbeatInterval = setInterval(() => {
            this.emit({ type: 'heartbeat', turn, elapsedMs: Date.now() - this.runStartedAt });
        }, 5000);
        let turn = 0;
        let hasNudgedForTools = false;
        let noToolRetryCount = 0;
        let postCompact = false;
        const MAX_NO_TOOL_RETRIES = 5;
        // Enhance system prompt with tool-use instructions when tools are available
        const hasTools = this.config.tools.getSchemas().length > 0;
        const effectiveSystemPrompt = hasTools
            ? this.config.systemPrompt + TOOL_USE_REINFORCEMENT
            : this.config.systemPrompt;
        try {
            while (turn < this.config.maxTurns) {
                turn++;
                this.emit({ type: 'thinking' });
                // ── Auto-compact: check BEFORE each LLM call ──
                // This runs even when the LLM doesn't call tools (e.g. ask-mode),
                // and uses a capped context window so large-context models still
                // trigger compaction at reasonable conversation lengths.
                const compactionCtxCap = Math.min(this.config.maxContextTokens, COMPACTION_MAX_CONTEXT);
                if (this.conversation.needsCompaction(compactionCtxCap)) {
                    await this.autoCompact();
                    // ★ Fix A: Reset retry count after compaction so the model gets fresh retries
                    noToolRetryCount = 0;
                    postCompact = true;
                    // ★ After compaction, inject a continuation directive so the LLM
                    // knows the task is still in progress and should continue working.
                    // Without this, the model may interpret the compressed summary as
                    // "task complete" and stop executing, requiring a manual nudge.
                    // ★ Fix D: Include recent context so the LLM knows what was just happening.
                    const lastMsgs = this.conversation.messages.slice(-3);
                    const lastCtx = lastMsgs
                        .filter((m) => m.role === 'assistant' || m.role === 'user')
                        .map((m) => {
                        const txt = typeof m.content === 'string' ? m.content.slice(0, 200) : '(non-text)';
                        return `[${m.role}]: ${txt}`;
                    })
                        .join('\n');
                    this.conversation.addUserMessage('[自动继续] 以上对话已由系统压缩。任务仍在进行中，请继续执行剩余步骤，根据需要调用工具。' +
                        '不要总结已经完成的工作——立即执行下一步操作。' +
                        '\n\n最近操作上下文：\n' + lastCtx);
                }
                // Get messages trimmed to context window
                const messages = this.conversation.getMessagesForLLM(this.config.maxContextTokens);
                const toolSchemas = this.config.tools.getSchemas();
                // Call LLM
                let responseText = '';
                let reasoningText = '';
                const toolCalls = [];
                const toolCallBuffers = new Map();
                // When nudging (retrying after model described but didn't call tools),
                // force tool_choice=required so the model MUST generate a tool call
                const toolChoice = hasNudgedForTools ? 'required' : undefined;
                // Per-turn timeout: abort if a single turn (LLM + tools) takes too long.
                // The LLM provider has its own http-level timeout via signalWithTimeout,
                // but this agent-level safety net also covers tool execution time and
                // catches edge cases where the provider's timeout unexpectedly fails.
                const turnController = new AbortController();
                const turnTimer = this.config.turnTimeout > 0
                    ? setTimeout(() => {
                        logger.warn(`[Agent] Turn ${turn} exceeded timeout (${Math.round(this.config.turnTimeout / 60000)} min), aborting`);
                        turnController.abort(new Error(`Turn timeout (${Math.round(this.config.turnTimeout / 60000)} min) reached`));
                    }, this.config.turnTimeout)
                    : null;
                // Merge per-turn signal with the global signal for the LLM call
                const turnMergedSignal = this.mergeSignals(mergedSignal, turnController.signal);
                try {
                    const stream = this.config.provider.chat({
                        messages,
                        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
                        toolChoice,
                        systemPrompt: effectiveSystemPrompt,
                        maxTokens: this.config.maxResponseTokens,
                        temperature: this.config.temperature,
                        signal: turnMergedSignal,
                    });
                    for await (const event of stream) {
                        switch (event.type) {
                            case 'text_delta':
                            case 'text':
                                responseText += (event.text ?? '');
                                this.emit({ type: 'text', text: event.text ?? '' });
                                break;
                            case 'reasoning_delta':
                                reasoningText += (event.text ?? '');
                                // Show reasoning to user as regular text
                                this.emit({ type: 'text', text: event.text ?? '' });
                                break;
                            case 'tool_call_start':
                                toolCallBuffers.set(String(event.id), { name: String(event.name), argsJson: '' });
                                break;
                            case 'tool_call_delta': {
                                const buf = toolCallBuffers.get(String(event.id));
                                if (buf)
                                    buf.argsJson += (String(event.args ?? '') ?? "");
                                break;
                            }
                            case 'tool_call_end': {
                                const buf = toolCallBuffers.get(String(event.id));
                                if (buf) {
                                    let args = {};
                                    try {
                                        args = buf.argsJson ? JSON.parse(buf.argsJson) : {};
                                    }
                                    catch (parseError) {
                                        logger.warn(`Failed to parse tool call args for ${buf.name}:`, buf.argsJson);
                                        logger.warn(`Parse error:`, parseError);
                                        // Continue with empty args - the tool itself will validate required parameters
                                    }
                                    // Validate that we have at least some arguments for tools that require them
                                    if (buf.name === 'bash' && (!args.command || typeof args.command !== 'string')) {
                                        logger.warn(`Bash tool called without required "command" parameter. Skipping execution.`);
                                        // Skip adding this tool call - it will fail validation in the tool itself
                                        break;
                                    }
                                    toolCalls.push({ id: String(event.id), name: buf.name, arguments: args });
                                }
                                break;
                            }
                            case 'usage':
                                this.emit({ type: 'usage', inputTokens: event.inputTokens, outputTokens: event.outputTokens });
                                break;
                            case 'done':
                                break;
                        }
                    }
                }
                catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error));
                    // Don't emit error event for normal aborts
                    const isAbortError = err.name === 'AbortError' ||
                        err.name === 'TimeoutError' ||
                        err.message === 'Aborted' ||
                        err.message === 'terminated' ||
                        err.message.includes('aborted') ||
                        err.message.includes('abort') ||
                        err.message.includes('terminated') ||
                        err.message.includes('max duration') ||
                        err.message.includes('Turn timeout');
                    // TimeoutError: provide user-friendly message with actionable advice
                    const isTimeoutError = err.name === 'TimeoutError';
                    if (isTimeoutError && !isAbortError) {
                        const friendlyMsg = `LLM request timed out. The model may be overloaded or the prompt is too complex.

Suggestions:
- Try again (transient server load may resolve)
- Reduce context length (fewer files, shorter history)
- Switch to a faster model in settings

Technical details: ${err.message}`;
                        this.emit({ type: 'error', error: new Error(friendlyMsg) });
                        throw new Error(friendlyMsg);
                    }
                    if (!isAbortError) {
                        this.emit({ type: 'error', error: err });
                    }
                    throw err;
                }
                // Add assistant message to conversation
                this.conversation.addAssistantMessage(responseText, toolCalls.length > 0 ? toolCalls : undefined, reasoningText || undefined);
                // If no tool calls, check if model needs a nudge to use tools
                if (toolCalls.length === 0) {
                    // If the model described actions without calling tools, retry once with a nudge
                    if (hasTools && !hasNudgedForTools && looksLikeToolIntent(responseText)) {
                        hasNudgedForTools = true;
                        logger.info('Model described tool actions without calling tools — injecting nudge and retrying');
                        this.conversation.addUserMessage(TOOL_NUDGE_MESSAGE);
                        if (turnTimer)
                            clearTimeout(turnTimer);
                        continue; // Loop back to call LLM again with the nudge
                    }
                    // ★ Fix B: Skip task-complete detection right after compaction.
                    // The model's first response post-compaction is often a confirmation that
                    // may look like completion ("已完成"), even though we injected a continuation.
                    // Skip completion detection until the model calls at least one tool.
                    const isTaskComplete = postCompact ? false : looksLikeTaskComplete(responseText);
                    postCompact = false; // Reset after checking regardless
                    if (isTaskComplete) {
                        logger.info('Task marked as complete by model');
                        if (turnTimer)
                            clearTimeout(turnTimer);
                        return responseText;
                    }
                    // If the task is not complete but no tools were called,
                    // check if we should auto-continue to nudge the model forward.
                    const shouldContinue = !isTaskComplete && turn < this.config.maxTurns && hasTools;
                    if (shouldContinue) {
                        noToolRetryCount++;
                        if (noToolRetryCount > MAX_NO_TOOL_RETRIES) {
                            logger.info('No tool calls after ' + MAX_NO_TOOL_RETRIES + ' retries - returning control to user');
                            this.conversation.addUserMessage('我已经尝试了多次自动继续，但模型没有执行新的操作。请提供更具体的指示或说明需要执行什么操作。');
                            if (turnTimer)
                                clearTimeout(turnTimer);
                            return responseText;
                        }
                        logger.info('No tool calls but task seems incomplete - prompting to continue (retry ' + noToolRetryCount + '/' + MAX_NO_TOOL_RETRIES + ')');
                        this.conversation.addUserMessage('[自动继续] 任务尚未完成，请继续执行。如有需要请调用工具完成操作。');
                        if (turnTimer)
                            clearTimeout(turnTimer);
                        continue; // Loop back to call LLM again
                    }
                    // Fallback: task appears complete or no tools available, return response text
                    if (turnTimer)
                        clearTimeout(turnTimer);
                    return responseText;
                }
                // Execute tool calls
                for (const tc of toolCalls) {
                    this.emit({ type: 'tool_start', name: tc.name, args: tc.arguments });
                    const toolContext = {
                        workingDirectory: this.config.workingDirectory,
                        signal: turnMergedSignal,
                        askUser: this.config.askUser,
                        sshTerminalId: this.config.sshTerminalId,
                        enableSandbox: this.config.enableSandbox,
                        onProgress: (text) => {
                            this.emit({ type: 'tool_progress', name: tc.name, text });
                        },
                    };
                    // ★ Fix A: Wrap tool execution in try-catch to prevent a single tool
                    // crash from killing the entire agent loop. Emit a proper error event
                    // and add a tool result with the error message so the LLM can recover.
                    let result;
                    try {
                        result = await this.executor.execute(tc, toolContext);
                    }
                    catch (execError) {
                        const errMsg = execError instanceof Error ? execError.message : String(execError);
                        logger.error(`[Agent] Tool '${tc.name}' execution failed:`, errMsg);
                        this.emit({ type: 'error', error: new Error(`Tool '${tc.name}' failed: ${errMsg}`) });
                        result = { content: `Error executing tool '${tc.name}': ${errMsg}`, isError: true };
                    }
                    this.conversation.addToolResult(tc.id, result);
                    this.emit({ type: 'tool_end', name: tc.name, result });
                }
                // Tools were called — reset the no-tool retry counter
                noToolRetryCount = 0;
                // Clear the per-turn timer now that this turn is complete
                if (turnTimer)
                    clearTimeout(turnTimer);
                // Drain intervention queue: inject any pending user interventions
                while (this.interventionQueue.length > 0) {
                    const intervention = this.interventionQueue.shift();
                    const prefixed = `[User Intervention] ${intervention}`;
                    this.conversation.addUserMessage(prefixed);
                    this.emit({ type: 'intervention_injected', text: intervention });
                }
                // Auto-compact now runs at the TOP of each turn (before LLM call).
                // The old in-loop check has been moved — see while loop start.
                // Continue the loop - LLM will see tool results
            }
            // Safety limit reached
            const msg = `Reached maximum number of turns (${this.config.maxTurns}). Stopping.`;
            this.emit({ type: 'error', error: new Error(msg) });
            return responseText_fallback(this.conversation);
        }
        finally {
            // Clear global timer to prevent leak
            if (globalTimer)
                clearTimeout(globalTimer);
            clearInterval(heartbeatInterval);
            // ALWAYS emit done so the renderer can reset isStreaming
            this.emit({ type: 'done' });
            // ── Memory Reflector: post-session reflection for memory consolidation ──
            if (this.reflector && this.reflector.shouldReflect()) {
                try {
                    const msgs = this.conversation.messages;
                    const memoryRecords = [];
                    for (let idx = 0; idx < msgs.length; idx++) {
                        const msg = msgs[idx];
                        if (msg.role === 'user' || msg.role === 'assistant') {
                            const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                            if (text) {
                                memoryRecords.push({
                                    id: String(idx),
                                    title: text.slice(0, 80),
                                    content: text,
                                    category: 'conversation',
                                    scope: 'session',
                                });
                            }
                        }
                    }
                    if (memoryRecords.length > 0) {
                        const reflectResult = await this.reflector.reflect(memoryRecords);
                        if (reflectResult) {
                            logger.info('[Agent] Reflector produced reflection insights');
                        }
                    }
                }
                catch (err) {
                    logger.warn('[Agent] Reflector reflect failed:', err.message);
                }
            }
            // ── Skill harvesting (Hermes-inspired): auto-create skills from conversations ──
            if (this.harvester) {
                const durationMs = Date.now() - this.runStartedAt;
                this.harvester.harvest(this.conversation, durationMs).then((skillName) => {
                    if (skillName) {
                        this.emit({ type: 'intervention_injected', text: `\u{1F4A1} Auto-created skill: ${skillName}` });
                    }
                }).catch((err) => {
                    logger.warn('[Harvester] Harvest failed:', err.message);
                });
            }
        }
    }
    /**
     * Auto-compact the conversation by summarizing old messages using the LLM.
     * Keeps recent messages intact and replaces older ones with a summary.
     */
    async autoCompact() {
        const keepRecent = 10;
        const source = this.conversation.buildCompactionSource(keepRecent);
        if (!source || source.length < 100)
            return;
        const tokensBefore = this.conversation.estimateTotalTokens();
        logger.info(`[Agent] Auto-compacting conversation: ${tokensBefore} tokens, ${this.conversation.messages.length} messages`);
        // Use an independent AbortController so compaction doesn't get
        // killed by the parent agent's abort signal or global timeout.
        const compactController = new AbortController();
        const compactTimeout = setTimeout(() => compactController.abort(new Error('Compaction timed out')), 120000);
        try {
            let summary = '';
            const stream = this.config.provider.chat({
                messages: [{ role: 'user', content: `Please summarize the following conversation:\n\n${source}` }],
                systemPrompt: COMPACTION_SYSTEM_PROMPT,
                maxTokens: 2048,
                temperature: 0.2,
                signal: compactController.signal,
            });
            for await (const event of stream) {
                if (event.type === 'text_delta') {
                    summary += event.text;
                }
            }
            if (summary && summary.length > 50) {
                this.conversation.compact(summary, keepRecent);
                const tokensAfter = this.conversation.estimateTotalTokens();
                logger.info(`[Agent] Compaction complete: ${tokensBefore} → ${tokensAfter} tokens (saved ${tokensBefore - tokensAfter})`);
            }
        }
        catch (err) {
            // Compaction failure is non-fatal — just log and continue
            logger.warn(`[Agent] Auto-compaction failed, continuing without compaction:`, err);
        }
        finally {
            clearTimeout(compactTimeout);
        }
    }
    /**
     * Merge two AbortSignals into one — aborts when either fires.
     * Uses AbortSignal.any() on Node >=20, falls back to manual wiring.
     */
    mergeSignals(a, b) {
        try {
            // AbortSignal.any() available since Node 20 / modern browsers
            return AbortSignal.any?.([a, b]) ?? this.mergeSignalsManual(a, b);
        }
        catch {
            return this.mergeSignalsManual(a, b);
        }
    }
    mergeSignalsManual(a, b) {
        const controller = new AbortController();
        const onAbort = () => { controller.abort(a.reason ?? b.reason); };
        a.addEventListener('abort', onAbort, { once: true });
        b.addEventListener('abort', onAbort, { once: true });
        // If either is already aborted, trigger immediately
        if (a.aborted || b.aborted)
            onAbort();
        return controller.signal;
    }
    getConversation() {
        return this.conversation;
    }
}
function responseText_fallback(conversation) {
    // Return the last assistant message content
    const messages = conversation.messages;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
            return Conversation.contentToText(messages[i].content);
        }
    }
    return '(No response generated)';
}
//# sourceMappingURL=agent.js.map