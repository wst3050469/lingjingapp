// Agent IPC handler - bridges Agent core with Electron renderer

import { ipcMain, Notification, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import {
  Agent,
  loadConfig,
  createProvider,
  createDefaultRegistry,
  loadPrompts,
  MAIN_PROMPT,
  ToolRegistry,
  getTodoList,
  getPrompt,
  getExpertPresets,
  initDispatchExpertsTool,
  initUpdateMemoryTool,
  initCodebaseSearchTool,
  initGetProblemsTool,
  type AgentEvent,
  type LLMProvider,
  type AppConfig,
  type Tool,
  type ToolContext,
  type ToolResult,
  type ExpertEvent,
} from '@codepilot/core';
import { readFile as readFileFS, writeFile as writeFileFS, unlink as unlinkFS } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { mcpManager } from './mcp-ipc.js';
import { getDatabase, saveDatabase } from '../db/database.js';
import { searchCodebase } from '../services/indexing-pipeline.js';
import { lspManager } from '../services/lsp/lsp-manager.js';
import { createSshBashTool } from '../tools/ssh-bash.js';
import { createSshFileReadTool, createSshFileWriteTool, createSshFileEditTool } from '../tools/ssh-file-tools.js';
import { createSshListDirTool } from '../tools/ssh-list-dir.js';
import { abortAllQuestAgents } from './quest-ipc.js';

let currentAgent: Agent | null = null;
let currentAbortController: AbortController | null = null;
let provider: LLMProvider | null = null;
let tools: ToolRegistry | null = null;
let config: AppConfig | null = null;
let workingDirectory = process.cwd();

// SSH terminal ID for remote execution
let currentSshTerminalId: string | null = null;

/**
 * Set the current SSH terminal ID for Agent mode (Chat).
 * Called when SSH connection changes in the renderer.
 */
export function setSshTerminalId(sshTerminalId: string | null): void {
  currentSshTerminalId = sshTerminalId;
  console.log('[Agent IPC] SSH Terminal ID set to:', sshTerminalId);
}

// Pending askUser requests
const pendingAskUser = new Map<string, { resolve: (answer: string) => void; timeout: NodeJS.Timeout }>();
let askUserCounter = 0;
const ASK_USER_TIMEOUT = 300_000; // 5 minutes

// Pending confirmation requests
const pendingConfirmation = new Map<string, { resolve: (reply: { approved: boolean; feedback?: string }) => void; timeout: NodeJS.Timeout }>();
let confirmCounter = 0;
const CONFIRM_TIMEOUT = 600_000; // 10 minutes

export async function initAgent(): Promise<void> {
  await loadPrompts();
  const loaded = await loadConfig();
  config = loaded.config;
  provider = createProvider(config);
  tools = createDefaultRegistry(config.tools.disabled, provider);
  initUpdateMemoryTool(getDatabase, saveDatabase);
  initCodebaseSearchTool(async (query, workspace, topK, filePattern) => {
    return searchCodebase(workspace, query, config!, getDatabase(), saveDatabase, topK, filePattern);
  });
  initGetProblemsTool(async (filePath, workspace, severity) => {
    lspManager.setWorkspace(workspace);
    if (filePath) {
      return lspManager.getDiagnostics(filePath, severity);
    }
    return lspManager.getProjectDiagnostics(severity);
  });
}

export function setWorkingDirectory(dir: string): void {
  workingDirectory = dir;
}

export async function reinitProvider(): Promise<void> {
  const loaded = await loadConfig();
  config = loaded.config;
  provider = createProvider(config);
  tools = createDefaultRegistry(config.tools.disabled, provider);
  initUpdateMemoryTool(getDatabase, saveDatabase);
}

// --- Tool Wrapping ---

interface ConfirmRequestData {
  requestId: string;
  type: 'bash' | 'mcp' | 'plan';
  toolName: string;
  args: Record<string, unknown>;
  command?: string;
  planContent?: string;
  planTitle?: string;
}

/**
 * Wrap a tool that requires user confirmation before execution.
 * bash and MCP tools are wrapped; autoExecute / blockedCommands config is checked.
 */
function wrapToolWithConfirmation(
  tool: Tool,
  getConfig: () => AppConfig,
  sendConfirmRequest: (req: ConfirmRequestData) => void,
  waitForReply: (requestId: string) => Promise<{ approved: boolean; feedback?: string }>
): Tool {
  return {
    ...tool,
    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const session = getConfig().session;

      // Determine confirmation type
      const isBash = tool.name === 'bash';
      const isMcp = tool.name.startsWith('mcp__');
      const isPlan = tool.name === 'plan';

      // MCP tools disabled check
      if (isMcp && !session.mcpTools) {
        return { content: 'MCP tools are disabled in session settings.', isError: true };
      }

      // Auto-execute: skip confirmation (except for blocked commands)
      if (session.autoExecute && !isPlan) {
        if (isBash) {
          const cmd = (params.command as string || '').trim();
          const cmdBase = cmd.split(/\s+/)[0];
          const blocked = session.blockedCommands.split(',').map((s: string) => s.trim()).filter(Boolean);
          if (blocked.includes(cmdBase)) {
            // Blocked command: still require confirmation even with autoExecute
          } else {
            return tool.execute(params, context);
          }
        } else {
          return tool.execute(params, context);
        }
      }

      // Build confirmation request
      const requestId = `confirm-${++confirmCounter}`;
      const type: 'bash' | 'mcp' | 'plan' = isPlan ? 'plan' : isBash ? 'bash' : 'mcp';

      const req: ConfirmRequestData = {
        requestId,
        type,
        toolName: tool.name,
        args: params,
      };

      if (isBash) {
        req.command = params.command as string;
      }
      if (isPlan) {
        req.planTitle = params.title as string;
        req.planContent = params.steps as string;
      }

      sendConfirmRequest(req);
      const { approved, feedback } = await waitForReply(requestId);

      if (!approved) {
        const reason = feedback ? `User rejected: ${feedback}` : 'User rejected the operation.';
        return { content: reason, isError: false };
      }

      return tool.execute(params, context);
    },
  };
}

/**
 * Wrap the todo tool to sync state to renderer after each 'set' action.
 */
function wrapTodoTool(
  tool: Tool,
  emitTodoUpdate: (items: Array<{ content: string; status: string }>) => void
): Tool {
  return {
    ...tool,
    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const result = await tool.execute(params, context);
      if (params.action === 'set' && !result.isError) {
        emitTodoUpdate(getTodoList() as Array<{ content: string; status: string }>);
      }
      return result;
    },
  };
}

/**
 * Wrap the dispatch_experts tool to inject onExpertEvent callback.
 */
function wrapDispatchExpertsWithEvents(
  tool: Tool,
  onExpertEvent: (event: ExpertEvent) => void
): Tool {
  return {
    ...tool,
    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      return tool.execute(params, { ...context, onExpertEvent });
    },
  };
}

/**
 * Wrap file_edit / file_write tools to capture before/after content snapshots.
 * Emits a 'file_snapshot' event so the renderer can compute diffs for review.
 */
function wrapFileToolWithSnapshot(
  tool: Tool,
  emitSnapshot: (data: {
    filePath: string;
    beforeContent: string | null;
    afterContent: string;
    toolName: string;
    isNewFile: boolean;
  }) => void
): Tool {
  return {
    ...tool,
    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
      const filePath = params.file_path as string;
      const absolutePath = isAbsolute(filePath) ? filePath : resolve(workingDirectory, filePath);

      // Capture before content (null if new file)
      let beforeContent: string | null = null;
      try {
        beforeContent = await readFileFS(absolutePath, 'utf-8');
      } catch {
        // File does not exist yet — will be created by file_write
      }

      // Execute original tool
      const result = await tool.execute(params, context);

      // If successful, capture after content and emit snapshot
      if (!result.isError) {
        try {
          const afterContent = await readFileFS(absolutePath, 'utf-8');
          emitSnapshot({
            filePath: absolutePath,
            beforeContent,
            afterContent,
            toolName: tool.name,
            isNewFile: beforeContent === null,
          });
        } catch {
          // Ignore read errors after execution
        }
      }

      return result;
    },
  };
}

// --- Self-evolution memory helpers ---

async function searchExpertMemory(query: string, projectPath: string): Promise<string> {
  try {
    const db = getDatabase();
    const stmt = db.prepare(
      `SELECT title, content FROM memories WHERE (title LIKE ? OR content LIKE ?) AND category = 'expert-learning' AND (scope = 'global' OR project_path = ?) ORDER BY updated_at DESC LIMIT 5`
    );
    stmt.bind([`%${query}%`, `%${query}%`, projectPath]);
    const results: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>;
      results.push(`- ${row.title}: ${row.content}`);
    }
    stmt.free();
    return results.join('\n');
  } catch {
    return '';
  }
}

async function saveExpertLearning(title: string, content: string, projectPath: string): Promise<void> {
  try {
    const db = getDatabase();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    db.run(
      `INSERT INTO memories (id, scope, project_path, category, title, content, source) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, 'project', projectPath, 'expert-learning', title, content, 'automatic']
    );
    await saveDatabase();
  } catch {
    // Silently ignore memory save errors
  }
}

// --- Registration ---

export function registerAgentIpc(mainWindow: BrowserWindow): void {
  // Send system notification when window is not focused and config allows it
  function sendNotification(title: string, body: string, configKey: string): void {
    try {
      if (mainWindow.isDestroyed() || mainWindow.isFocused()) return;
      const notifications = (config as any)?.notifications;
      if (notifications && notifications[configKey] === false) return;
      if (!Notification.isSupported()) return;
      const n = new Notification({ title, body });
      n.on('click', () => {
        mainWindow.show();
        mainWindow.focus();
      });
      n.show();
    } catch {
      // Ignore notification errors silently
    }
  }

  // Helper: send confirm request to renderer
  function sendConfirmRequest(req: ConfirmRequestData): void {
    sendNotification('灵境', '需要您的确认: ' + req.toolName, 'conversation');
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:confirm-request', req);
    }
  }

  // Helper: wait for confirmation reply
  function waitForConfirmReply(requestId: string): Promise<{ approved: boolean; feedback?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingConfirmation.delete(requestId);
        // Instead of rejecting (which kills the agent), resolve with approved:false
        // so the agent skips this command gracefully and can continue
        resolve({ approved: false, feedback: '用户未在10分钟内确认，已自动跳过' });
      }, CONFIRM_TIMEOUT);
      pendingConfirmation.set(requestId, { resolve, timeout });
    });
  }

  // Helper: send todo update event to renderer
  function emitTodoUpdate(items: Array<{ content: string; status: string }>): void {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', { type: 'todo_update', items });
    }
  }

  // Helper: send file snapshot event to renderer for diff review
  function emitFileSnapshot(data: {
    filePath: string;
    beforeContent: string | null;
    afterContent: string;
    toolName: string;
    isNewFile: boolean;
  }): void {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', {
        type: 'file_snapshot',
        filePath: data.filePath,
        beforeContent: data.beforeContent,
        afterContent: data.afterContent,
        toolName: data.toolName,
        isNewFile: data.isNewFile,
      });
    }
  }

  ipcMain.handle('agent:run', async (event: IpcMainInvokeEvent, { message, mode, images, conversationMessages, conversationId }: {
    message: string; mode?: string; images?: Array<{ data: string; mediaType: string }>; conversationMessages?: any[]; conversationId?: string }) => {
    // Use requesting window for event routing (instead of fixed senderWindow)
    const senderWindow: BrowserWindow = BrowserWindow.fromWebContents(event.sender) || mainWindow;

    // ── Window-aware helper overrides ──
    // Shadow the outer helpers to route confirm/todo/snapshot events
    // to the SENDER window instead of the first mainWindow.
    const sendConfirmToSender = (req: ConfirmRequestData): void => {
      sendNotification('灵境', '需要您的确认: ' + req.toolName, 'conversation');
      if (!senderWindow.isDestroyed()) {
        senderWindow.webContents.send('agent:confirm-request', req);
      }
    };

    const emitTodoToSender = (items: Array<{ content: string; status: string }>): void => {
      if (!senderWindow.isDestroyed()) {
        senderWindow.webContents.send('agent:event', { type: 'todo_update', items });
      }
    };

    const emitFileSnapshotToSender = (data: {
      filePath: string;
      beforeContent: string | null;
      afterContent: string;
      toolName: string;
      isNewFile: boolean;
    }): void => {
      if (!senderWindow.isDestroyed()) {
        senderWindow.webContents.send('agent:event', {
          type: 'file_snapshot',
          filePath: data.filePath,
          beforeContent: data.beforeContent,
          afterContent: data.afterContent,
          toolName: data.toolName,
          isNewFile: data.isNewFile,
        });
      }
    };

    if (!provider || !tools || !config) {
      await initAgent();
    }

    // Always reload config to pick up runtime changes (language, autoExecute, etc.)
    try {
      const freshConfig = await loadConfig();
      config = freshConfig.config;
    } catch {}

    // Abort any existing Chat agent before starting new one (prevents event pollution)
    if (currentAbortController) {
      currentAbortController.abort();
      currentAgent = null;
    }

    // Abort all Quest agents when entering Chat mode (prevents Quest agents from
    // generating events that pollute the Chat conversation stream)
    abortAllQuestAgents();
    currentAbortController = new AbortController();

    // Expert event forwarder (for experts mode)
    function forwardExpertEvent(event: ExpertEvent): void {
      if (!senderWindow.isDestroyed()) {
        senderWindow.webContents.send('agent:event', event);
      }
    }

    // Build tool registry based on mode
    let runTools: ToolRegistry;
    if (mode === 'ask') {
      // Ask mode: no tools, LLM responds with text only in a single turn
      runTools = new ToolRegistry();
    } else if (mode === 'experts') {
      // Experts mode: full tools + dispatch_experts, auto-execute for most tools
      const expertBaseTools = createDefaultRegistry(config!.tools.disabled, provider!, 'experts');
      runTools = new ToolRegistry();

      for (const tool of expertBaseTools.getAll()) {
        let wrapped = tool;

        if (tool.name === 'dispatch_experts') {
          wrapped = wrapDispatchExpertsWithEvents(tool, forwardExpertEvent);
        } else if (tool.name === 'plan') {
          // plan always requires user confirmation
          wrapped = wrapToolWithConfirmation(
            tool,
            () => config!,
            sendConfirmToSender,
            waitForConfirmReply
          );
        } else if (tool.name === 'bash') {
          // Always use SSH bash wrapper (falls back to local if no SSH connection)
          const bashWrapper = createSshBashTool(() => currentSshTerminalId);
          // bash: auto-execute except blocked commands
          wrapped = wrapToolWithConfirmation(
            bashWrapper,
            () => ({ ...config!, session: { ...config!.session, autoExecute: true } }),
            sendConfirmToSender,
            waitForConfirmReply
          );
        } else if (tool.name === 'todo') {
          wrapped = wrapTodoTool(tool, emitTodoToSender);
        }

        // Always use SSH file tools (falls back to local if no SSH connection)
        if (tool.name === 'file_read') {
          wrapped = createSshFileReadTool(() => currentSshTerminalId);
        } else if (tool.name === 'file_write') {
          wrapped = createSshFileWriteTool(() => currentSshTerminalId);
        } else if (tool.name === 'file_edit') {
          wrapped = createSshFileEditTool(() => currentSshTerminalId);
        }

        // Always use SSH list_dir (falls back to local if no SSH connection)
        if (tool.name === 'list_dir') {
          wrapped = createSshListDirTool(() => currentSshTerminalId);
        }

        // Snapshot wrapping for file tools (diff review)
        if (tool.name === 'file_edit' || tool.name === 'file_write') {
          wrapped = wrapFileToolWithSnapshot(wrapped, emitFileSnapshotToSender);
        }

        runTools.register(wrapped);
      }

      // MCP tools: auto-execute in experts mode
      for (const mcpTool of mcpManager.getAllTools()) {
        runTools.register(mcpTool);
      }
    } else {
      // Agent mode: full tool registry + MCP tools, with wrapping
      runTools = new ToolRegistry();

      for (const tool of tools!.getAll()) {
        let wrapped = tool;

        if (tool.name === 'bash') {
          // Always use SSH bash wrapper (falls back to local if no SSH connection)
          const bashWrapper = createSshBashTool(() => currentSshTerminalId);
          wrapped = wrapToolWithConfirmation(
            bashWrapper,
            () => config!,
            sendConfirmToSender,
            waitForConfirmReply
          );
        } else if (tool.name === 'todo') {
          wrapped = wrapTodoTool(tool, emitTodoToSender);
        } else if (tool.name === 'plan') {
          wrapped = wrapToolWithConfirmation(
            tool,
            () => config!,
            sendConfirmToSender,
            waitForConfirmReply
          );
        }

        // Always use SSH file tools (falls back to local if no SSH connection)
        if (tool.name === 'file_read') {
          wrapped = createSshFileReadTool(() => currentSshTerminalId);
        } else if (tool.name === 'file_write') {
          wrapped = createSshFileWriteTool(() => currentSshTerminalId);
        } else if (tool.name === 'file_edit') {
          wrapped = createSshFileEditTool(() => currentSshTerminalId);
        }

        // Always use SSH list_dir (falls back to local if no SSH connection)
        if (tool.name === 'list_dir') {
          wrapped = createSshListDirTool(() => currentSshTerminalId);
        }

        // Snapshot wrapping for file tools (diff review)
        if (tool.name === 'file_edit' || tool.name === 'file_write') {
          wrapped = wrapFileToolWithSnapshot(wrapped, emitFileSnapshotToSender);
        }

        runTools.register(wrapped);
      }

      // Wrap MCP tools with confirmation
      for (const mcpTool of mcpManager.getAllTools()) {
        const wrapped = wrapToolWithConfirmation(
          mcpTool,
          () => config!,
          sendConfirmToSender,
          waitForConfirmReply
        );
        runTools.register(wrapped);
      }
    }

    // Compose system prompt (with optional memory enhancement)
    let systemPrompt = composeSystemPrompt(config!, mode);

    // Self-evolution: pre-task memory search (experts mode or autoMemory enabled)
    if (mode === 'experts' || config!.autoMemory) {
      const keywords = message.slice(0, 200).replace(/[^\w\u4e00-\u9fff\s]/g, ' ').trim();
      const memories = await searchExpertMemory(keywords, workingDirectory);
      if (memories) {
        systemPrompt += '\n\n## Past Experience\n' + memories;
      }
    }

    // When autoMemory is enabled, instruct the agent to proactively save memories
    if (config!.autoMemory) {
      systemPrompt += `\n\n## Auto Memory
You have access to the \`update_memory\` tool. During this conversation, proactively use it to save important information you learn about the user, including:
- User preferences (coding style, language, framework choices, etc.)
- Project details (architecture, tech stack, naming conventions, etc.)
- Workflow patterns (testing approaches, deployment processes, etc.)
- Common issues and solutions encountered
Save each memory with an appropriate category ("preference", "project", "workflow", "issue", "knowledge") and scope ("global" for cross-project, "project" for this project only).
Only save genuinely useful, non-trivial information. Do NOT save obvious or temporary details.`;
    }

    currentAgent = new Agent({
      provider: provider!,
      tools: runTools,
      systemPrompt,
      maxTurns: config!.maxTurns,
      maxDuration: config!.maxDuration,
      maxContextTokens: config!.maxContextTokens,
      maxResponseTokens: config!.maxResponseTokens,
      temperature: config!.temperature,
      workingDirectory,
      sshTerminalId: currentSshTerminalId || undefined,
      onEvent: (event: AgentEvent) => {
        if (!senderWindow.isDestroyed()) {
          senderWindow.webContents.send('agent:event', serializeEvent(event));
        }
        if (event.type === 'done') {
          sendNotification('灵境', '会话已完成回复', 'conversation');
        }
      },
      askUser: (question: string) => {
        sendNotification('灵境', '需要您的操作: ' + question.slice(0, 80), 'conversation');
        return new Promise<string>((resolve, reject) => {
          const requestId = `ask-${++askUserCounter}`;
          const timeout = setTimeout(() => {
            pendingAskUser.delete(requestId);
            // Instead of rejecting (which kills the agent), resolve with empty string
            // so the agent pauses gracefully and can continue when user returns
            resolve('');
          }, ASK_USER_TIMEOUT);
          pendingAskUser.set(requestId, { resolve, timeout });
          if (!senderWindow.isDestroyed()) {
            senderWindow.webContents.send('agent:ask-user', { requestId, question });
          } else {
            clearTimeout(timeout);
            pendingAskUser.delete(requestId);
            reject(new Error('窗口已关闭'));
          }
        });
      },
    });

    // Capture the abort controller for race-free finally cleanup
    const runAbortController = currentAbortController;

    // Hydrate conversation with previous messages if provided
    if (conversationMessages && conversationMessages.length > 0) {
      try {
        currentAgent.getConversation().hydrate(conversationMessages);
      } catch { /* ignore hydration errors */ }
    }

    try {
      const finalResponse = await currentAgent.run(message, currentAbortController.signal, images);

      // Self-evolution: post-task learning save for experts mode
      if (mode === 'experts' && finalResponse) {
        const learningMatch = finalResponse.match(/## Learnings?\n([\s\S]*?)(?=\n## |\n---|\s*$)/i);
        if (learningMatch) {
          const learningContent = learningMatch[1].trim();
          if (learningContent.length > 10) {
            const learningTitle = 'Expert session: ' + message.slice(0, 80);
            await saveExpertLearning(learningTitle, learningContent, workingDirectory);
          }
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!senderWindow.isDestroyed()) {
        senderWindow.webContents.send('agent:event', {
          type: 'error',
          error: { message: msg },
        });
        senderWindow.webContents.send('agent:event', { type: 'done' });
      }
    } finally {
      // Guard: only clear if this is still the current agent (prevents race)
      if (currentAbortController === runAbortController) {
        currentAbortController = null;
        currentAgent = null;
      }
    }
  });

  ipcMain.handle('agent:abort', async () => {
    currentAbortController?.abort();
  });

  ipcMain.handle('agent:reset-conversation', async () => {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = null;
    currentAgent = null;
  });

  ipcMain.handle('agent:ask-user:reply', async (_event, { requestId, answer }: { requestId: string; answer: string }) => {
    const entry = pendingAskUser.get(requestId);
    if (entry) {
      clearTimeout(entry.timeout);
      entry.resolve(answer);
      pendingAskUser.delete(requestId);
    }
  });

  ipcMain.handle('agent:confirm:reply', async (_event, { requestId, approved, feedback }: { requestId: string; approved: boolean; feedback?: string }) => {
    const entry = pendingConfirmation.get(requestId);
    if (entry) {
      clearTimeout(entry.timeout);
      entry.resolve({ approved, feedback });
      pendingConfirmation.delete(requestId);
    }
  });

  ipcMain.handle('agent:intervention', async (_event, { text }: { text: string }) => {
    if (currentAgent && text.trim()) {
      currentAgent.injectIntervention(text.trim());
      return { success: true };
    }
    return { success: false };
  });

  // --- Diff Review IPC handlers ---

  ipcMain.handle('diff-review:revert', async (_event, { filePath, content }: { filePath: string; content: string }) => {
    await writeFileFS(filePath, content, 'utf-8');
  });

  ipcMain.handle('diff-review:delete', async (_event, { filePath }: { filePath: string }) => {
    await unlinkFS(filePath);
  });
}

const ASK_MODE_PROMPT = `You are an intelligent coding assistant called 灵境 (LingJing). You help developers by answering questions, explaining code, reviewing and optimizing code, generating code suggestions, fixing problems, and troubleshooting compile errors.

Key guidelines:
- Provide clear, concise, and accurate answers
- When reviewing code, point out potential bugs, performance issues, and best practices
- When explaining code, break it down step by step
- When suggesting fixes, provide the corrected code with explanations
- When optimizing code, explain what was changed and why
- Use markdown formatting with code blocks for code snippets
- If code context is provided, focus your response on that specific code
- You do NOT have access to any tools - respond with text/code only`;

function composeSystemPrompt(cfg: AppConfig, mode?: string): string {
  let prompt: string;

  if (mode === 'ask') {
    prompt = ASK_MODE_PROMPT;
  } else if (mode === 'experts') {
    prompt = getPrompt('team-lead.md');
    const expertList = getExpertPresets()
      .map(p => `- \`${p.name}\` ${p.emoji ?? ''} - ${p.description}`)
      .join('\n');
    prompt += '\n\n## Available Expert Types\n' + expertList;
  } else {
    prompt = cfg.systemPrompt ?? MAIN_PROMPT;
  }

  // Append language instruction
  // Values: 'zh' -> Chinese, 'en' -> English, 'auto' -> detect from system locale
  const lang = (cfg as any).language || 'auto';
  if (lang === 'zh') {
    prompt += '\n\nAlways respond in Chinese (\u4E2D\u6587).';
  } else if (lang === 'en') {
    prompt += '\n\nAlways respond in English.';
  } else if (lang === 'auto') {
    const systemLang = (process.env.LANG || '').toLowerCase();
    if (/^(zh|cmn)/.test(systemLang)) {
      prompt += '\n\nAlways respond in Chinese (\u4E2D\u6587).';
    }
  }

  // Append user-defined rules
  if ((cfg as any).rules && (cfg as any).rules.trim()) {
    prompt += '\n\n## User Rules\n' + (cfg as any).rules.trim();
  }

  return prompt;
}

function serializeEvent(event: AgentEvent): Record<string, unknown> {
  switch (event.type) {
    case 'thinking':
      return { type: 'thinking' };
    case 'text':
      return { type: 'text', text: event.text };
    case 'tool_start':
      return { type: 'tool_start', name: event.name, args: event.args };
    case 'tool_progress':
      return { type: 'tool_progress', name: event.name, text: event.text };
    case 'tool_end':
      return { type: 'tool_end', name: event.name, result: event.result };
    case 'usage':
      return { type: 'usage', inputTokens: event.inputTokens, outputTokens: event.outputTokens };
    case 'intervention_injected':
      return { type: 'intervention_injected', text: event.text };
    case 'error':
      return { type: 'error', error: { message: event.error.message } };
    case 'workflow_started':
      return { type: 'workflow_started', workflowId: event.workflowId, featureName: event.featureName };
    case 'workflow_progress':
      return { type: 'workflow_progress', workflowId: event.workflowId, phase: event.phase, status: event.status };
    case 'done':
      return { type: 'done' };
    default:
      return { type: 'unknown' };
  }
}
