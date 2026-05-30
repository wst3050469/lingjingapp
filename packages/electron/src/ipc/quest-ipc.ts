// @ts-nocheck - Ghost errors from TS sourcemap mismatch; esbuild ignores types
// Quest IPC handler - independent pipeline for Quest Mode autonomous tasks

import { ipcMain, Notification, type BrowserWindow } from 'electron';

import {

  Agent,

  Conversation,

  loadConfig,

  createProvider,

  createDefaultRegistry,

  loadPrompts,

  getPrompt,

  MAIN_PROMPT,

  ToolRegistry,

  getTodoList,

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

  type Message,

  getModelContextWindow,

} from '@codepilot/core';

import { readFile as readFileFS, writeFile as writeFileFS, unlink as unlinkFS } from 'node:fs/promises';

import { isAbsolute, resolve, join } from 'node:path';

import { mcpManager } from './mcp-ipc.js';

import { getDatabase, saveDatabase } from '../db/database.js';

import { searchCodebase } from '../services/indexing-pipeline.js';



/** Safe JSON parse — prevents "[object Object]" crashes when DB values are already objects */

function safeJsonParse<T>(val: unknown, fallback: T): T {

  if (typeof val !== 'string') return fallback;

  try { return JSON.parse(val) as T; } catch { return fallback; }

}

import { createWorktree, removeWorktree, isGitRepo } from './worktree-manager.js';

import { createContainer, removeContainer, isDockerAvailable } from './docker-manager.js';

import { searchMemories, extractKeywords, summarizeConversation, buildMemoryPromptSection, AUTO_MEMORY_INSTRUCTION } from '../services/memory-service.js';

import { loadAllRules, applyRules, getManualRules } from '@codepilot/core/rules';

import { buildContextSection } from '../services/context-service.js';

import { createSshBashTool } from '../tools/ssh-bash.js';

import { createSshFileReadTool, createSshFileWriteTool, createSshFileEditTool } from '../tools/ssh-file-tools.js';

import { createSshListDirTool } from '../tools/ssh-list-dir.js';

import { questStateManager } from './quest-state-ipc.js';



// Persistent agent map: one agent per task

const taskAgents = new Map<string, { agent: Agent; abortController: AbortController; worktreePath?: string; containerId?: string; runId?: string }>();



// Module-level workspace getter (set by registerQuestIpc, used by abortAllQuestAgents)

let _getWorkspace: (() => string) | null = null;



// Pending askUser requests per task

const pendingAskUser = new Map<string, (answer: string) => void>();

let askUserCounter = 0;



// Pending confirmation requests per task

const pendingConfirmation = new Map<string, (reply: { approved: boolean; feedback?: string }) => void>();

let confirmCounter = 0;



let provider: LLMProvider | null = null;

let config: AppConfig | null = null;



// SSH terminal ID for remote execution

let currentSshTerminalId: string | null = null;



/**

 * Set the current SSH terminal ID for Quest mode.

 * Called when SSH connection changes in the renderer.

 */

export function setQuestSshTerminalId(sshTerminalId: string | null): void {

  currentSshTerminalId = sshTerminalId;

  console.log('[Quest IPC] SSH Terminal ID set to:', sshTerminalId);

}



/**

 * Always reload config and re-create provider.

 * This ensures quest mode picks up model/API key changes made via settings UI.

 */

async function ensureInitialized(): Promise<void> {

  await loadPrompts();

  const loaded = await loadConfig();

  config = loaded.config;

  provider = createProvider(config);

  // Initialize memory tool so Quest mode agents can persist memories

  initUpdateMemoryTool(getDatabase, saveDatabase);

  // Initialize codebase search tool for semantic search

  initCodebaseSearchTool(async (query, workspace, topK, filePattern) => {

    return searchCodebase(workspace, query, config!, getDatabase(), saveDatabase, topK, filePattern);

  });

}



/**

 * Reset cached provider/config so next ensureInitialized() reloads from disk.

 * Called when user changes model or API keys via config:set.

 */

export function reinitQuestProvider(): void {

  provider = null;

  config = null;

}



// --- Tool Wrapping (reused patterns from agent-ipc.ts) ---



function wrapToolWithConfirmation(

  tool: Tool,

  getConfig: () => AppConfig,

  sendConfirmRequest: (req: any) => void,

  waitForReply: (requestId: string) => Promise<{ approved: boolean; feedback?: string }>,

  autoMode: string

): Tool {

  return {

    ...tool,

    async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {

      const session = getConfig().session;

      const isBash = tool.name === 'bash';

      const isPlan = tool.name === 'plan';



      // Auto mode: auto-approve everything except plan

      if (autoMode === 'auto' && !isPlan) {

        if (isBash) {

          const cmd = (params.command as string || '').trim();

          const cmdBase = cmd.split(/\s+/)[0];

          const blocked = session.blockedCommands.split(',').map((s: string) => s.trim()).filter(Boolean);

          if (!blocked.includes(cmdBase)) {

            return tool.execute(params, context);

          }

        } else {

          return tool.execute(params, context);

        }

      }



      // Manual mode or blocked command: require confirmation

      const requestId = `quest-confirm-${++confirmCounter}`;

      const type: 'bash' | 'mcp' | 'plan' = isPlan ? 'plan' : isBash ? 'bash' : 'mcp';

      const req: any = { requestId, type, toolName: tool.name, args: params };

      if (isBash) req.command = params.command;

      if (isPlan) { req.planTitle = params.title; req.planContent = params.steps; }



      sendConfirmRequest(req);

      const { approved, feedback } = await waitForReply(requestId);



      if (!approved) {

        return { content: feedback ? `User rejected: ${feedback}` : 'User rejected the operation.', isError: false };

      }

      return tool.execute(params, context);

    },

  };

}



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



function wrapFileToolWithSnapshot(

  tool: Tool,

  workingDirectory: string,

  emitSnapshot: (data: {

    filePath: string;

    beforeContent: string | null;

// @ts-expect-error - TS2554: Expected 1 arguments, but got 2
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



      let beforeContent: string | null = null;

      try {

        beforeContent = await readFileFS(absolutePath, 'utf-8');

      } catch {

        // new file

      }



      const result = await tool.execute(params, context);



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

          // ignore

        }

      }

      return result;

    },

  };

}



// --- Spec Detection ---



/**

 * Per-task spec detection tracker.

 * Each quest task gets its own Map so specs can be re-detected across tasks.

 * The Map is cleaned up when the task completes.

 */

const _taskSpecTracker = new Map<string, Set<string>>();



function getSpecTracker(taskId: string): Set<string> {

  let tracker = _taskSpecTracker.get(taskId);

  if (!tracker) {

    tracker = new Set<string>();

    _taskSpecTracker.set(taskId, tracker);

  }

  return tracker;

}



/** Clear spec tracker for a completed/cancelled task to free memory */

export function clearSpecTracker(taskId: string): void {

  _taskSpecTracker.delete(taskId);

}



/**

 * Per-task preview URL tracker — prevents spamming the same URL.

 */

const _previewUrlTracker = new Map<string, Set<string>>();



function getPreviewUrlTracker(taskId: string): Set<string> {

  let tracker = _previewUrlTracker.get(taskId);

  if (!tracker) {

    tracker = new Set<string>();

    _previewUrlTracker.set(taskId, tracker);

  }

  return tracker;

}



function clearPreviewUrlTracker(taskId: string): void {

  _previewUrlTracker.delete(taskId);

}



/** Enhanced preview URL regex — matches localhost, 127.0.0.1, 0.0.0.0, [::1] */

const PREVIEW_URL_RE = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d+/g;



/** Extract preview URLs from text, skipping duplicates for a given task */

function extractPreviewUrls(text: string, taskId?: string): string[] {

  const matches = text.match(PREVIEW_URL_RE);

  if (!matches) return [];

  if (!taskId) return [...new Set(matches)];

  const tracker = getPreviewUrlTracker(taskId);

  const result: string[] = [];

  for (const url of matches) {

    if (!tracker.has(url)) {

      tracker.add(url);

      result.push(url);

    }

  }

  return result;

}



function detectSpecBlock(text: string, taskId?: string): string | null {

  const tracker = taskId ? getSpecTracker(taskId) : null;

  // Format 1: :::spec fenced block (primary format)

  // Uses [ \\t]* instead of \\s* to avoid matching across multiple newlines,

  // and \\r?\\n to support both Unix and Windows line endings.

  const fenceMatch = text.match(/:::spec[ \t]*\r?\n([\s\S]*?)\r?\n:::[ \t]*(?:\r?\n|$)/);

  if (fenceMatch) {

    const content = fenceMatch[1].trim();

    if (!content) return null;

    const key = content.slice(0, 200); // dedup marker (first 200 chars)

    if (tracker && tracker.has(key)) return null;

    tracker?.add(key);

    return content;

  }



  // Format 2: # Spec heading (alternative format)

  const headingMatch = text.match(/# Spec[ \t]*\r?\n([\s\S]*?)(?=\r?\n# |\r?\n:::\r?\n|\r?\n$|$)/);

  if (headingMatch) {

    const content = headingMatch[1].trim();

    if (!content) return null;

    const key = content.slice(0, 200);

    if (tracker && tracker.has(key)) return null;

    tracker?.add(key);

    return `# Spec\n${content}`;

  }



  return null;

}



// --- Quest System Prompts ---



function composeQuestSystemPrompt(cfg: AppConfig, scenario: string, chatMode?: string): string {

  let prompt: string;



  // Research mode: use research-expert persona with web search workflow

  if (chatMode === 'research') {

    prompt = getPrompt('research-expert.md');

    const thinkingPrompt = getPrompt('thinking.md');

    if (thinkingPrompt) {

      prompt += '\n\n' + thinkingPrompt;

    }

    prompt += '\n\n## Research Mode Active\n\nYou are in **Research Mode**. Your core workflow:\n1. Search the web for relevant information using `web_search`\n2. Fetch detailed pages using `web_fetch` when needed\n3. Analyze and synthesize findings from multiple sources\n4. Provide a well-reasoned, cited answer\n\nAlways search before answering questions that might benefit from current information.';

  } else {

  switch (scenario) {

    case 'spec': {

      const specPrompt = getPrompt('quest-spec.md');

      // getPrompt never throws — it returns FALLBACK_MAIN_PROMPT when

      // the requested prompt is not loaded. Detect by checking for the

      // distinctive ":::spec" marker (absent in the generic fallback).

      if (specPrompt.includes(':::spec') || specPrompt.includes('Spec-Driven')) {

        prompt = specPrompt;

      } else {

        // Embedded fallback (same content as quest-spec.md)

        // Ensures spec instructions are ALWAYS in the system prompt

        // even when quest-spec.md is not loaded into the prompt cache.

        prompt = `You are an autonomous programming agent operating in Quest Mode (Spec-Driven Development).



## Identity



You are part of the 灵境 (LingJing) IDE. You have full access to the project filesystem, shell commands, and development tools. You operate independently, making decisions and executing code changes autonomously.



## Workflow



Follow this strict workflow for Spec-Driven development:



### Phase 1: Requirements Analysis

- Carefully analyze the user's request

- Explore the existing codebase to understand architecture, patterns, and conventions

- Identify affected files, dependencies, and potential conflicts

- If requirements are ambiguous, use ask_user to clarify before proceeding



### Phase 2: Spec Generation

Generate a detailed technical specification wrapped in a \`:::spec\` block:



\`\`\`

:::spec

# [Feature/Change Title]



## Overview

Brief description of what will be built/changed.



## Architecture

- Key design decisions

- Component/module structure

- Data flow description



## Implementation Steps

1. Step 1: [description]

2. Step 2: [description]

...



## Files to Create/Modify

- \`path/to/file.ts\` - Description of changes

- \`path/to/new-file.ts\` - New file purpose



## Verification Plan

- How to test the implementation

- Edge cases to consider

:::

\`\`\`



### Phase 3: Wait for Approval

After generating the spec, **stop and wait for user feedback**. Do not proceed with implementation until the user approves the spec or provides revision feedback.



### Phase 4: Implementation

Once approved:

1. Use the **todo** tool to create a task list from the spec's implementation steps

2. Implement each step methodically, marking todos as you progress

3. Write clean, production-quality code following existing project conventions

4. Add necessary error handling and type safety



### Phase 5: Verification

1. Run the project's build/lint/typecheck commands

2. Run relevant tests

3. Fix any issues found

4. Report completion with a summary of all changes made



## Guidelines



- **Follow existing patterns**: Match the codebase's coding style, naming conventions, and architecture

- **Minimal footprint**: Only change what's necessary. Don't refactor unrelated code

- **Track progress**: Always use the todo tool for multi-step implementations

- **Be thorough**: Include error handling, type annotations, and edge case coverage

- **Communicate clearly**: Explain key decisions in your spec and during implementation

- **Security first**: Never introduce vulnerabilities (XSS, injection, etc.)`;

      }

      break;

    }

    case 'prototype': {

      const protoPrompt = getPrompt('quest-prototype.md');

      // Detect if the real prototype prompt was loaded

      if (protoPrompt.includes('Rapid Prototyping') && !protoPrompt.includes('Coding Assistant')) {

        prompt = protoPrompt;

      } else {

        prompt = `You are an autonomous programming agent operating in Quest Mode (Rapid Prototyping).



## Identity



You are part of the 灵境 (LingJing) IDE. You specialize in rapidly creating visual, interactive prototypes. You have full access to the project filesystem and shell commands.



## Goals



1. **Speed over perfection**: Get something working and visible as fast as possible

2. **Visual quality**: Create polished, modern UI with good typography, spacing, and color

3. **Interactivity**: Make prototypes interactive and responsive

4. **Iteration**: Quickly incorporate user feedback to refine the prototype



## Workflow



### Step 1: Understand the Vision

- Parse the user's description of what they want

- Ask clarifying questions only if critical details are missing

- Default to modern, clean design choices when unspecified



### Step 2: Build the Prototype

- Create self-contained files (HTML + CSS + JS, or framework-specific)

- Use modern CSS (flexbox, grid, custom properties, transitions)

- Include responsive design breakpoints

- Add realistic placeholder content

- Make interactive elements functional



### Step 3: Launch and Preview

- Write files to the project directory

- Start a dev server if needed

- Provide the preview URL to the user



### Step 4: Iterate

- Listen to user feedback

- Make targeted changes quickly

- Show results immediately after each iteration



## Design Principles



- **Modern aesthetics**: Clean lines, adequate whitespace, readable typography

- **Consistent spacing**: Use a spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px)

- **Color harmony**: Use a cohesive color palette with proper contrast ratios

- **Responsive**: Mobile-first approach, works on all screen sizes

- **Accessible**: Proper semantic HTML, ARIA labels, keyboard navigation

- **Animated**: Subtle transitions and animations for polish



## Tech Preferences



When the user doesn't specify a technology:

- For simple pages: vanilla HTML/CSS/JS

- For interactive apps: React with Tailwind CSS

- For data-heavy UIs: React with a component library

- Always use modern ES modules and current best practices



## Guidelines



- Write all code directly to files - don't just show code snippets

- Start a preview server when possible

- Use the todo tool to track multi-step prototyping tasks

- Prioritize visual completeness over code perfection

- Include real-looking placeholder data, not "Lorem ipsum"`;

      }

      break;

    }

    case 'tool': {

      const toolPrompt = getPrompt('quest-tool.md');

      // Detect if the real tool prompt was loaded

      if (toolPrompt.includes('Tool Creation') && !toolPrompt.includes('Coding Assistant')) {

        prompt = toolPrompt;

      } else {

        prompt = `You are an autonomous programming agent operating in Quest Mode (Tool Creation).



## Identity



You are part of the 灵境 (LingJing) IDE. You specialize in creating reliable, well-crafted automation tools and scripts. You have full access to the project filesystem and shell commands.



## Goals



1. **Reliability**: Create tools that handle errors gracefully and work consistently

2. **Usability**: Clear CLI interfaces with help text and examples

3. **Portability**: Self-contained tools that work across environments

4. **Testability**: Tools that can be verified immediately after creation



## Workflow



### Step 1: Define the Tool

- Understand what the tool should do

- Determine input/output format

- Identify dependencies and runtime requirements

- Choose the right language (shell script, Python, Node.js, etc.)



### Step 2: Implement

- Write the tool with a clear structure:

  - Argument parsing with validation

  - Help text / usage information

  - Core logic with proper error handling

  - Progress indicators for long operations

  - Clean output formatting

- Make the file executable

- Include a shebang line for scripts



### Step 3: Test

- Run the tool with sample inputs

- Test edge cases (empty input, invalid args, missing files)

- Verify error messages are helpful

- Ensure exit codes are correct



### Step 4: Document

- Add usage examples in help text

- Include inline comments for complex logic

- Provide installation/setup instructions if needed



## Design Principles



- **Fail fast**: Validate inputs early, fail with clear error messages

- **Progress feedback**: Show what's happening during long operations

- **Idempotent when possible**: Running the tool twice shouldn't cause issues

- **Unix philosophy**: Do one thing well, compose with other tools via stdin/stdout

- **No surprises**: Default behavior should be safe and predictable



## Language Selection Guide



- **Shell (bash/zsh)**: File operations, git workflows, system tasks

- **Python**: Data processing, API interactions, complex logic

- **Node.js**: Web-related tools, JSON processing, npm ecosystem tasks

- **Go**: Performance-critical CLI tools, cross-platform distribution



## Output Format



Tools should have structured, parseable output:

- Use color/emoji for human readability (when stdout is a terminal)

- Support \`--json\` flag for machine-readable output when appropriate

- Write errors to stderr, results to stdout

- Use standard exit codes



## Guidelines



- Always test the tool after creating it

- Include \`--help\` or \`-h\` flag support

- Handle Ctrl+C (SIGINT) gracefully

- Use the todo tool to track multi-step tool creation

- Make tools self-documenting with clear variable names and comments`;

      }

      break;

    }

    default:

      prompt = cfg.systemPrompt ?? MAIN_PROMPT;

  }

  }



  // Append language instruction
  // Values: 'zh' -> Chinese, 'en' -> English, 'auto' -> detect from system locale
  const questLang = (cfg as any).language || 'auto';
  if (questLang === 'zh') {

    prompt += '\n\nAlways respond in Chinese.';

  } else if (questLang === 'en') {

    prompt += '\n\nAlways respond in English.';

  } else if (questLang === 'auto') {
    const systemLang = (process.env.LANG || '').toLowerCase();
    if (/^(zh|cmn)/.test(systemLang)) {
      prompt += '\n\nAlways respond in Chinese.';
    }
  }



  // Append user rules (support both legacy string and new array format)

  const rules = (cfg as any).rules;

  if (rules) {

    if (typeof rules === 'string' && rules.trim()) {

      prompt += '\n\n## User Rules\n' + rules.trim();

    } else if (Array.isArray(rules) && rules.length > 0) {

      const activeRules = rules.filter((r: any) => r.enabled && r.type === 'always');

      if (activeRules.length > 0) {

        prompt += '\n\n## Active Rules\n\n';

        prompt += '> **Priority**: When Rules and Memories conflict, Rules take precedence.\n\n';

        for (const rule of activeRules) {

          prompt += `### ${rule.name}\n${rule.content}\n\n`;

        }

      }

    }

  }



  return prompt;

}



// --- Registration ---



export function registerQuestIpc(mainWindow: BrowserWindow, getWorkspace: () => string): void {



  // Helper to send logs to renderer

  function sendLog(message: string, data?: any) {

  _getWorkspace = getWorkspace;

    try {

      if (!mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {

        mainWindow.webContents.send('quest:log', { message, data: data ? JSON.stringify(data) : undefined });

      }

    } catch (e) {

      // Ignore send errors

    }

    console.log('[Quest Main Process]', message, data || '');

  }



  function sendNotification(title: string, body: string): void {

    try {

      if (mainWindow.isDestroyed() || mainWindow.isFocused()) return;

      if (!Notification.isSupported()) return;

      const n = new Notification({ title, body });

      n.on('click', () => { mainWindow.show(); mainWindow.focus(); });

      n.show();

    } catch { /* ignore */ }

  }



  function sendQuestEvent(event: Record<string, unknown>): void {

    if (!mainWindow.isDestroyed()) {

      mainWindow.webContents.send('quest:event', event);

    }

  }



  function sendConfirmRequest(req: any): void {

    sendNotification('Quest', 'Confirmation needed: ' + req.toolName);

    if (!mainWindow.isDestroyed()) {

      mainWindow.webContents.send('quest:confirm-request', req);

    }

  }



  function waitForConfirmReply(requestId: string): Promise<{ approved: boolean; feedback?: string }> {

    return new Promise((resolve) => {

      pendingConfirmation.set(requestId, resolve);

    });

  }



  function emitTodoUpdate(items: Array<{ content: string; status: string }>): void {

    sendQuestEvent({ type: 'todo_update', items });

  }



  function emitFileSnapshot(data: {

    filePath: string;

    beforeContent: string | null;

    afterContent: string;

    toolName: string;

    isNewFile: boolean;

  }, taskId?: string): void {

    sendQuestEvent({

      type: 'file_snapshot',

      taskId,

      filePath: data.filePath,

      beforeContent: data.beforeContent,

      afterContent: data.afterContent,

      toolName: data.toolName,

      isNewFile: data.isNewFile,

    });

  }



  // --- Quest Task CRUD ---



  sendLog('[Quest IPC] Registering quest IPC handlers...');



  try {

    ipcMain.handle('quest:create-task', async (_event, params: {

      scenario: string; runMode: string; autoMode: string; title?: string;

    }) => {

      sendLog('[Quest IPC] create-task called:', params);

      try {

        sendLog('[Quest IPC] Getting database...');

        const db = getDatabase();

        sendLog('[Quest IPC] Database retrieved successfully');

        const id = `quest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

        const title = params.title || 'New Quest';

        sendLog('[Quest IPC] Inserting into database:', { id, title, scenario: params.scenario, runMode: params.runMode, autoMode: params.autoMode });

        db.run(

          `INSERT INTO quest_tasks (id, user_id, title, scenario, run_mode, auto_mode, status) VALUES (?, 1, ?, ?, ?, ?, 'idle')`,

          [id, title, params.scenario, params.runMode, params.autoMode]

        );

        sendLog('[Quest IPC] Insert executed, saving database...');

        await saveDatabase();

        sendLog('[Quest IPC] Task created successfully:', id);

        return { id, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

      } catch (err) {

        sendLog('[Quest IPC] Failed to create task:', err);

        sendLog('[Quest IPC] Error stack:', err instanceof Error ? err.stack : 'No stack');

        return { error: err instanceof Error ? err.message : String(err) };

      }

    });

    sendLog('[Quest IPC] quest:create-task handler registered');

  } catch (err) {

    sendLog('[Quest IPC] Failed to register create-task handler:', err);

  }



  try {

    ipcMain.handle('quest:list-tasks', async () => {

      const db = getDatabase();

      const stmt = db.prepare(`SELECT * FROM quest_tasks ORDER BY updated_at DESC`);

      const tasks: any[] = [];

      while (stmt.step()) {

        tasks.push(stmt.getAsObject());

      }

      stmt.free();

      return tasks;

    });

    sendLog('[Quest IPC] quest:list-tasks handler registered');

  } catch (err) {

    sendLog('[Quest IPC] Failed to register list-tasks handler:', err);

  }



  ipcMain.handle('quest:load-task', async (_event, { taskId }: { taskId: string }) => {

    const db = getDatabase();

    const stmt = db.prepare(`SELECT * FROM quest_messages WHERE task_id = ? ORDER BY id ASC`);

    stmt.bind([taskId]);

    const messages: any[] = [];

    while (stmt.step()) {

      messages.push(stmt.getAsObject());

    }

    stmt.free();

    return messages;

  });



  ipcMain.handle('quest:delete-task', async (_event, { taskId }: { taskId: string }) => {

    // Abort if running

    const taskAgent = taskAgents.get(taskId);

    if (taskAgent) {

      taskAgent.abortController.abort();

      // Clean up worktree if it was used

      if (taskAgent.worktreePath) {

        try {

          await removeWorktree(getWorkspace(), taskAgent.worktreePath);

        } catch { /* ignore */ }

      }

      if (taskAgent.containerId) {

        removeContainer(taskAgent.containerId).catch(() => {});

      }

      taskAgents.delete(taskId);

    }



    // Also check DB for worktree path (task may have been stopped already)

    const db = getDatabase();

    const wtStmt = db.prepare(`SELECT worktree_path FROM quest_tasks WHERE id = ?`);

    wtStmt.bind([taskId]);

    if (wtStmt.step()) {

      const row = wtStmt.getAsObject() as Record<string, unknown>;

      const wtPath = row.worktree_path as string;

      if (wtPath) {

        try {

          await removeWorktree(getWorkspace(), wtPath);

        } catch { /* ignore */ }

      }

    }

    wtStmt.free();



    db.run(`DELETE FROM quest_messages WHERE task_id = ?`, [taskId]);

    db.run(`DELETE FROM quest_tasks WHERE id = ?`, [taskId]);

    await saveDatabase();

    return { success: true };

  });



  ipcMain.handle('quest:rename-task', async (_event, { taskId, title }: { taskId: string; title: string }) => {

    const db = getDatabase();

    db.run(`UPDATE quest_tasks SET title = ?, updated_at = datetime('now') WHERE id = ?`, [title, taskId]);

    await saveDatabase();

    return { success: true };

  });



  ipcMain.handle('quest:update-spec', async (_event, { taskId, content }: { taskId: string; content: string }) => {

    const db = getDatabase();

    db.run(`UPDATE quest_tasks SET spec_content = ?, updated_at = datetime('now') WHERE id = ?`, [content, taskId]);

    await saveDatabase();

    return { success: true };

  });



  // --- Quest File Revert ---

  ipcMain.handle('quest:revert-file', async (_event, { filePath, beforeContent }: { filePath: string; beforeContent: string | null }) => {
    try {
      if (beforeContent === null) {
        // New file: delete it
        await unlinkFS(filePath);
      } else {
        // Edited file: restore original content
        await writeFileFS(filePath, beforeContent, 'utf-8');
      }
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendLog(`[Quest IPC] revert-file failed: ${message}`);
      return { success: false, error: message };
    }
  });

  // --- Quest Run ---



  ipcMain.handle('quest:run', async (_event, {

    taskId, message, scenario, runMode, autoMode, contexts, runId, images, chatMode,

  }: {

    taskId: string; message: string; scenario: string; runMode: string; autoMode: string; contexts?: Array<{ id: string; type: string; label: string; path: string }>; runId?: string; images?: Array<{ data: string; mediaType: string }>; chatMode?: string;

  }) => {

    try {

      await ensureInitialized();

    } catch (initError) {

      const msg = initError instanceof Error ? initError.message : String(initError);

      sendQuestEvent({ type: 'error', error: { message: `Provider initialization failed: ${msg}` }, taskId });

      sendQuestEvent({ type: 'done', taskId });

      try {

        const db = getDatabase();

        db.run(`UPDATE quest_tasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?`, [taskId]);

        await saveDatabase();

      } catch { /* ignore */ }

      sendQuestEvent({ type: 'status_change', taskId, status: 'failed' });

      return;

    }



    if (!config || !provider) {

      sendQuestEvent({ type: 'error', error: { message: 'Configuration not loaded. Please check your settings (API key, model, etc.).' }, taskId });

      sendQuestEvent({ type: 'done', taskId });

      sendQuestEvent({ type: 'status_change', taskId, status: 'failed' });

      return;

    }



    // Clean up any stale agent for the same task (from previous run / switch-back)

    const oldAgent = taskAgents.get(taskId);

    if (oldAgent) {

      try {

        saveTaskMessages(taskId, oldAgent.agent);

      } catch { /* ignore */ }

      oldAgent.abortController.abort();

      if (oldAgent.worktreePath) {

        try { await removeWorktree(getWorkspace(), oldAgent.worktreePath); } catch { /* ignore */ }

      }

      if (oldAgent.containerId) {

        removeContainer(oldAgent.containerId).catch(() => {});

      }

      taskAgents.delete(taskId);

    }



    const baseWorkDir = getWorkspace();

    const abortController = new AbortController();



    // Determine working directory based on run mode

    let workDir = baseWorkDir;

    let worktreePath: string | undefined;



    if (runMode === 'worktree') {

      const isRepo = await isGitRepo(baseWorkDir);

      if (isRepo) {

        try {

          const result = await createWorktree(baseWorkDir, taskId);

          worktreePath = result.worktreePath;

          workDir = result.worktreePath;

          // Store worktree path in DB

          const db = getDatabase();

          db.run(`UPDATE quest_tasks SET worktree_path = ? WHERE id = ?`, [worktreePath, taskId]);

          await saveDatabase();

        } catch (err) {

          // Fall back to local mode if worktree creation fails

          sendQuestEvent({ type: 'error', error: { message: `Worktree creation failed, falling back to local mode: ${err instanceof Error ? err.message : String(err)}` }, taskId });

        }

      } else {

        sendQuestEvent({ type: 'error', error: { message: 'Not a git repository, falling back to local mode' }, taskId });

      }

    }



    let containerId: string | undefined;



    if (runMode === 'remote') {

      const dockerReady = await isDockerAvailable();

      if (dockerReady) {

        try {

          const container = await createContainer(workDir, taskId);

          containerId = container.containerId;

          // Note: workDir stays the same (volume-mounted), but bash commands will

          // be proxied into the container via tool wrapping below

        } catch (err) {

          sendQuestEvent({ type: 'error', error: { message: `Docker container creation failed, falling back to local mode: ${err instanceof Error ? err.message : String(err)}` }, taskId });

        }

      } else {

        sendQuestEvent({ type: 'error', error: { message: 'Docker not available, falling back to local mode' }, taskId });

      }

    }



    // Build tools based on run mode

    const baseTools = createDefaultRegistry(config.tools.disabled, provider);

    const runTools = new ToolRegistry();



    for (const tool of baseTools.getAll()) {

      let wrapped = tool;



      if (tool.name === 'bash') {

        // Always use SSH bash wrapper (falls back to local if no SSH connection)

        // Pass getter function so the tool always uses the latest SSH terminal ID

        // (handles reconnections during long-running tasks)

        const bashTool = createSshBashTool(() => currentSshTerminalId);

        

        wrapped = wrapToolWithConfirmation(

          bashTool,

          () => config as AppConfig,

          sendConfirmRequest,

          waitForConfirmReply,

          autoMode

        );

      } else if (tool.name === 'plan') {

        wrapped = wrapToolWithConfirmation(

          tool,

          () => config as AppConfig,

          sendConfirmRequest,

          waitForConfirmReply,

          autoMode

        );

      } else if (tool.name === 'todo') {

        wrapped = wrapTodoTool(tool, emitTodoUpdate);

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



      if (tool.name === 'file_edit' || tool.name === 'file_write') {

        const emitSnapshotWithTaskId = (data: Parameters<typeof emitFileSnapshot>[0]) => emitFileSnapshot(data, taskId);

        wrapped = wrapFileToolWithSnapshot(wrapped, workDir, emitSnapshotWithTaskId);

      }



      runTools.register(wrapped);

    }



    // MCP tools

    for (const mcpTool of mcpManager.getAllTools()) {

      if (autoMode === 'auto') {

        runTools.register(mcpTool);

      } else {

        const wrapped = wrapToolWithConfirmation(

          mcpTool,

          () => config as AppConfig,

          sendConfirmRequest,

          waitForConfirmReply,

          autoMode

        );

        runTools.register(wrapped);

      }

    }



    // Compose system prompt

    let questPrompt = composeQuestSystemPrompt(config, scenario, chatMode);



    // Load and apply rules from .qoder/rules/ and AGENTS.md

    try {

      const workspacePath = getWorkspace();

      const configRules = Array.isArray((config as any).rules) ? (config as any).rules : [];

      const loadedRules = loadAllRules(workspacePath, configRules);

      

      // Combine all rules

      const allRules = [

        ...loadedRules.configRules,

        ...loadedRules.fileRules,

        ...(loadedRules.agentsMdRule ? [loadedRules.agentsMdRule] : []),

      ];

      

      // Apply rules based on type

      const rulesText = applyRules(allRules);

      if (rulesText) {

        questPrompt += rulesText;

      }

    } catch (error) {

      console.warn('Failed to load rules:', error);

    }



    // Context injection - inject user-provided context files/folders/rules

    if (contexts && contexts.length > 0) {

      const contextSection = await buildContextSection(contexts);

      if (contextSection) {

        questPrompt += contextSection;

      }

    }



    // Memory injection (when autoMemory is enabled)

    if (config?.autoMemory) {

      const keywords = extractKeywords(message);

      const memories = await searchMemories(keywords, baseWorkDir, getDatabase);

      if (memories) {

        questPrompt += '\n\n## Past Experience & Context\n\n';

        questPrompt += '> **Priority**: When Rules and Memories conflict, Rules take precedence.\n\n';

        questPrompt += memories;

      }

      questPrompt += AUTO_MEMORY_INSTRUCTION;

    }



    // Accumulated text for spec detection

    let accumulatedText = '';



    const agent = new Agent({

      provider,

      tools: runTools,

      systemPrompt: questPrompt,

      maxTurns: Math.max(config.maxTurns ?? 500, 500),

      maxDuration: config.maxDuration,

      turnTimeout: Math.max(config.turnTimeout ?? 1_200_000, 300_000), // at least 5min for Quest mode

      maxContextTokens: getModelContextWindow(config.model, config.maxContextTokens),

      maxResponseTokens: config.maxResponseTokens,

      temperature: config.temperature,

      workingDirectory: workDir,

      sshTerminalId: currentSshTerminalId || undefined,

      onEvent: (event: AgentEvent) => {

        const serialized = serializeEvent(event);

        serialized.taskId = taskId;

        if (runId) serialized.runId = runId;

        sendQuestEvent(serialized);



        // Spec detection on text events

        if (event.type === 'text') {

          accumulatedText += event.text;

          const spec = detectSpecBlock(accumulatedText, taskId);

          if (spec) {

            // Save spec and emit event

            try {

              const db = getDatabase();

              db.run(`UPDATE quest_tasks SET spec_content = ?, updated_at = datetime('now') WHERE id = ?`, [spec, taskId]);

              saveDatabase().catch(() => {});

            } catch { /* ignore */ }

            sendQuestEvent({ type: 'spec_generated', taskId, specContent: spec });

          }



          // Preview URL auto-detection from AI output (enhanced)

          const urls = extractPreviewUrls(event.text, taskId);

          for (const url of urls) {

            sendQuestEvent({ type: 'preview_url', url, taskId });

          }

        }



        // NOTE: 'done' event is just forwarded to renderer for UI reset (streaming, etc.).

        // Status changes, DB updates, message saves, and taskAgents cleanup are handled

        // in the try/catch/finally block AFTER agent.run() — NOT here.

        // This prevents stale done events (from aborted agents) from corrupting the state

        // of a newly-started agent for the same task.

      },

      askUser: (question: string) => {

        sendNotification('Quest', 'Input needed: ' + question.slice(0, 80));

        return new Promise<string>((resolve) => {

          const requestId = `quest-ask-${++askUserCounter}`;

          pendingAskUser.set(requestId, resolve);

          if (!mainWindow.isDestroyed()) {

            mainWindow.webContents.send('quest:ask-user', { requestId, question });

          }

        });

      },

    });



    taskAgents.set(taskId, { agent, abortController, worktreePath, containerId, runId });



    // Load previous messages from database and hydrate the conversation

    try {

      const db = getDatabase();

      const msgStmt = db.prepare(

        `SELECT role, content, tool_calls FROM quest_messages WHERE task_id = ? ORDER BY id ASC`

      );

      msgStmt.bind([taskId]);

      const previousMessages: any[] = [];



      while (msgStmt.step()) {

        const row = msgStmt.getAsObject() as Record<string, unknown>;

        const role = row.role as string;

        const content = row.content as string || '';



        if (role === 'user') {

          previousMessages.push({ role: 'user', content });

        } else if (role === 'assistant') {

          const toolCalls = safeJsonParse(row.tool_calls, undefined);

          previousMessages.push({ role: 'assistant', content, toolCalls });

        } else if (role === 'tool') {

          const parsed = safeJsonParse(row.tool_calls, null);

          const toolCallId = parsed ? ((parsed as any).toolCallId || (parsed as any)?.[0]?.id || '') : ''

          previousMessages.push({ role: 'tool', toolCallId, content });

        }

      }

      msgStmt.free();



      // Fix empty toolCallIds from old DB records

      fixToolCallIds(previousMessages);



      // Fix incomplete tool call sequences left by aborted runs

      const integrityFixed = fixConversationIntegrity(previousMessages);



      // Hydrate conversation with previous messages

      if (integrityFixed.length > 0) {

        agent.getConversation().hydrate(integrityFixed);

      }

    } catch { /* ignore */ }



    // Update status to running

    try {

      const db = getDatabase();

      db.run(`UPDATE quest_tasks SET status = 'running', updated_at = datetime('now') WHERE id = ?`, [taskId]);



      // Auto-set title from first message

      const titleStmt = db.prepare(`SELECT title FROM quest_tasks WHERE id = ?`);

      titleStmt.bind([taskId]);

      if (titleStmt.step()) {

        const row = titleStmt.getAsObject() as Record<string, unknown>;

        if (row.title === 'New Quest') {

          const autoTitle = message.slice(0, 50) + (message.length > 50 ? '...' : '');

          db.run(`UPDATE quest_tasks SET title = ? WHERE id = ?`, [autoTitle, taskId]);

          sendQuestEvent({ type: 'title_change', taskId, title: autoTitle });

        }

      }

      titleStmt.free();

      await saveDatabase();

    } catch { /* ignore */ }



    sendQuestEvent({ type: 'status_change', taskId, status: 'running', runId });



    try {

      await agent.run(message, abortController.signal, images);



      // ── Agent completed successfully ──

      sendNotification('Quest', 'Task completed');

      // ── Final spec detection from accumulated text ──

      // If spec wasn't detected during streaming (e.g. text arrived in chunks),

      // do a final scan of the complete accumulated text.

      try {

        if (accumulatedText) {

          const finalSpec = detectSpecBlock(accumulatedText, taskId);

          if (finalSpec) {

            const db_final = getDatabase();

            db_final.run(`UPDATE quest_tasks SET spec_content = ?, updated_at = datetime('now') WHERE id = ?`, [finalSpec, taskId]);

            saveDatabase().catch(() => {});

            sendQuestEvent({ type: 'spec_generated', taskId, specContent: finalSpec });

          }

        }

      } catch { /* final spec detection is non-critical */ }

      saveTaskMessages(taskId, agent);

      // Auto memory: post-task summarization

      if (config?.autoMemory) {

        const msgs = agent.getConversation().messages;

        summarizeConversation(provider!, msgs, baseWorkDir, getDatabase, saveDatabase).catch(() => {});

      }

      try {

        const db = getDatabase();

        db.run(`UPDATE quest_tasks SET status = 'completed', updated_at = datetime('now') WHERE id = ?`, [taskId]);

        saveDatabase().catch(() => {});

      } catch { /* ignore */ }

      clearSpecTracker(taskId);

      clearPreviewUrlTracker(taskId);

      sendQuestEvent({ type: 'status_change', taskId, status: 'completed', runId });

    } catch (error) {

      const msg = error instanceof Error ? error.message : String(error);

      const errName = error instanceof Error ? error.name : '';

      

      // Check if this is a normal abort (not an actual error)

      const isAbortError = errName === 'AbortError' || 

                           msg === 'Aborted' ||

                           msg.includes('aborted') ||

                           msg.includes('abort');

      

      if (!isAbortError) {

        // Real error — save progress, mark failed

        // NOTE: error + done events are already emitted by the Agent itself

        // (via onEvent callback). Only send status_change here.

        try {

          saveTaskMessages(taskId, agent);

        } catch { /* ignore */ }

        try {

          const db = getDatabase();

          db.run(`UPDATE quest_tasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?`, [taskId]);

          await saveDatabase();

        } catch { /* ignore */ }

        clearSpecTracker(taskId);

        sendQuestEvent({ type: 'status_change', taskId, status: 'failed', runId });

      }

      // Abort errors: status is handled by the caller (stopOnSwitch / pause / abort)

    } finally {

      // Guard: only clean up if this agent is still the current one for the task

      const current = taskAgents.get(taskId);

      if (current && (!current.runId || current.runId === runId)) {

        taskAgents.delete(taskId);

      }

    }

  });



  // --- Quest Abort / Pause / Resume ---



  ipcMain.handle('quest:abort', async (_event, { taskId }: { taskId: string }) => {

    const taskAgent = taskAgents.get(taskId);

    if (taskAgent) {

      // Save messages before aborting (parity with quest:pause)

      saveTaskMessages(taskId, taskAgent.agent);

      taskAgent.abortController.abort();

      // Clean up container if remote mode

      if (taskAgent.containerId) {

        removeContainer(taskAgent.containerId).catch(() => {});

      }

      taskAgents.delete(taskId);

      

      // Notify renderer that task is done/aborted

      sendQuestEvent({ type: 'done', taskId });

      sendQuestEvent({ type: 'status_change', taskId, status: 'failed' });

    }



    // Persist status change to database

    try {

      const db = getDatabase();

      db.run(`UPDATE quest_tasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?`, [taskId]);

      await saveDatabase();

    } catch { /* ignore */ }

  });



  ipcMain.handle('quest:pause', async (_event, { taskId }: { taskId: string }) => {

    const taskAgent = taskAgents.get(taskId);

    if (taskAgent) {

      // Save messages before aborting

      saveTaskMessages(taskId, taskAgent.agent);

      taskAgent.abortController.abort();

      taskAgents.delete(taskId);

      

      // Notify renderer that task is paused/done

      sendQuestEvent({ type: 'done', taskId });

    }



    try {

      const db = getDatabase();

      db.run(`UPDATE quest_tasks SET status = 'paused', updated_at = datetime('now') WHERE id = ?`, [taskId]);

      await saveDatabase();

    } catch { /* ignore */ }



    sendQuestEvent({ type: 'status_change', taskId, status: 'paused' });

  });



  ipcMain.handle('quest:resume', async (_event, { taskId, message, runId }: { taskId: string; message?: string; runId?: string }) => {

    try {

      await ensureInitialized();

    } catch (initError) {

      const msg = initError instanceof Error ? initError.message : String(initError);

      sendQuestEvent({ type: 'error', error: { message: `Provider initialization failed: ${msg}` }, taskId });

      sendQuestEvent({ type: 'done', taskId });

      try {

        const db2 = getDatabase();

        db2.run(`UPDATE quest_tasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?`, [taskId]);

        await saveDatabase();

      } catch { /* ignore */ }

      sendQuestEvent({ type: 'status_change', taskId, status: 'failed' });

      return;

    }



    if (!config || !provider) {

      sendQuestEvent({ type: 'error', error: { message: 'Configuration not loaded. Please check your settings.' }, taskId });

      sendQuestEvent({ type: 'done', taskId });

      sendQuestEvent({ type: 'status_change', taskId, status: 'failed' });

      return;

    }



    const db = getDatabase();

    const taskStmt = db.prepare(`SELECT scenario, run_mode, auto_mode FROM quest_tasks WHERE id = ?`);

    taskStmt.bind([taskId]);

    let scenario = 'spec';

    let runMode = 'local';

    let autoMode = 'auto';

    if (taskStmt.step()) {

      const row = taskStmt.getAsObject() as Record<string, unknown>;

      scenario = row.scenario as string || 'spec';

      runMode = row.run_mode as string || 'local';

      autoMode = row.auto_mode as string || 'auto';

    }

    taskStmt.free();



    // Load previous messages from DB to hydrate conversation

    const msgStmt = db.prepare(`SELECT role, content, tool_calls FROM quest_messages WHERE task_id = ? ORDER BY id ASC`);

    msgStmt.bind([taskId]);

    const previousMessages: Message[] = [];

    while (msgStmt.step()) {

      const row = msgStmt.getAsObject() as Record<string, unknown>;

      const role = row.role as string;

      const content = row.content as string || '';

      if (role === 'user') {

        previousMessages.push({ role: 'user', content });

      } else if (role === 'assistant') {

        const toolCalls = safeJsonParse(row.tool_calls, undefined);

        previousMessages.push({ role: 'assistant', content, toolCalls });

      } else if (role === 'tool') {

        const parsed = safeJsonParse(row.tool_calls, null);

          const toolCallId = parsed ? ((parsed as any).toolCallId || (parsed as any)?.[0]?.id || '') : ''

        previousMessages.push({ role: 'tool', toolCallId, content });

      }

    }

    msgStmt.free();



    // Fix empty toolCallIds from old DB records

    fixToolCallIds(previousMessages);



    // Fix incomplete tool call sequences left by aborted runs

    const integrityFixed = fixConversationIntegrity(previousMessages);



    const workDir = getWorkspace();

    const abortController = new AbortController();



    // Build tools (same as quest:run)

    const baseTools = createDefaultRegistry(config.tools.disabled, provider);

    const runTools = new ToolRegistry();



    for (const tool of baseTools.getAll()) {

      let wrapped = tool;

      if (tool.name === 'bash') {

        // Always use SSH bash wrapper (falls back to local if no SSH connection)

        const bashTool = createSshBashTool(() => currentSshTerminalId);

        wrapped = wrapToolWithConfirmation(bashTool, () => config as AppConfig, sendConfirmRequest, waitForConfirmReply, autoMode);

      } else if (tool.name === 'plan') {

        wrapped = wrapToolWithConfirmation(tool, () => config as AppConfig, sendConfirmRequest, waitForConfirmReply, autoMode);

      } else if (tool.name === 'todo') {

        wrapped = wrapTodoTool(tool, emitTodoUpdate);

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

      

      if (tool.name === 'file_edit' || tool.name === 'file_write') {

        const emitSnapshotWithTaskId = (data: Parameters<typeof emitFileSnapshot>[0]) => emitFileSnapshot(data, taskId);

        wrapped = wrapFileToolWithSnapshot(wrapped, workDir, emitSnapshotWithTaskId);

      }

      runTools.register(wrapped);

    }



    for (const mcpTool of mcpManager.getAllTools()) {

      if (autoMode === 'auto') {

        runTools.register(mcpTool);

      } else {

        runTools.register(wrapToolWithConfirmation(mcpTool, () => config as AppConfig, sendConfirmRequest, waitForConfirmReply, autoMode));

      }

    }



    let resumePrompt = composeQuestSystemPrompt(config, scenario);



    // Memory injection for resume (when autoMemory is enabled)

    if (config?.autoMemory) {

      const resumeKeywords = extractKeywords(

        previousMessages.filter(m => m.role === 'user').map(m => (m as any).content || '').join(' '),

      );

      if (resumeKeywords) {

        const memories = await searchMemories(resumeKeywords, workDir, getDatabase);

        if (memories) {

          resumePrompt += '\n\n' + buildMemoryPromptSection(memories);

        }

      }

      resumePrompt += AUTO_MEMORY_INSTRUCTION;

    }



    let accumulatedText = '';



    const agent = new Agent({

      provider,

      tools: runTools,

      systemPrompt: resumePrompt,

      maxTurns: Math.max(config.maxTurns ?? 500, 500),

      maxDuration: config.maxDuration,

      maxContextTokens: getModelContextWindow(config.model, config.maxContextTokens),

      maxResponseTokens: config.maxResponseTokens,

      temperature: config.temperature,

      workingDirectory: workDir,

      sshTerminalId: currentSshTerminalId || undefined,

      onEvent: (event: AgentEvent) => {

        const serialized = serializeEvent(event);

        serialized.taskId = taskId;

        if (runId) serialized.runId = runId;

        sendQuestEvent(serialized);



        if (event.type === 'text') {

          accumulatedText += event.text;

          const spec = detectSpecBlock(accumulatedText, taskId);

          if (spec) {

            try {

              const db2 = getDatabase();

              db2.run(`UPDATE quest_tasks SET spec_content = ?, updated_at = datetime('now') WHERE id = ?`, [spec, taskId]);

              saveDatabase();

            } catch { /* ignore */ }

            sendQuestEvent({ type: 'spec_generated', taskId, specContent: spec });

          }

        

          // Preview URL auto-detection from AI output (enhanced)

          const urls = extractPreviewUrls(event.text, taskId);

          for (const url of urls) {

            sendQuestEvent({ type: 'preview_url', url, taskId });

          }

        }



        // NOTE: 'done' event is just forwarded to renderer for UI reset.

        // Status changes, DB updates, message saves, and taskAgents cleanup are handled

        // in the try/catch/finally block AFTER agent.run() — NOT here.

      },

      askUser: (question: string) => {

        sendNotification('Quest', 'Input needed: ' + question.slice(0, 80));

        return new Promise<string>((resolve) => {

          const requestId = `quest-ask-${++askUserCounter}`;

          pendingAskUser.set(requestId, resolve);

          if (!mainWindow.isDestroyed()) {

            mainWindow.webContents.send('quest:ask-user', { requestId, question });

          }

        });

      },

    });



    // Hydrate conversation with previous messages (integrity-fixed)

    if (integrityFixed.length > 0) {

      agent.getConversation().hydrate(integrityFixed);

    }



    taskAgents.set(taskId, { agent, abortController, runId });



    // Update status

    try {

      db.run(`UPDATE quest_tasks SET status = 'running', updated_at = datetime('now') WHERE id = ?`, [taskId]);

      await saveDatabase();

    } catch { /* ignore */ }



    sendQuestEvent({ type: 'status_change', taskId, status: 'running', runId });



    const resumeMessage = message || 'Continue from where you left off. Review our conversation history and proceed with the next steps.';



    try {

      await agent.run(resumeMessage, abortController.signal);



      // ── Agent completed successfully ──

      sendNotification('Quest', 'Task resumed and completed');

      // ── Final spec detection from accumulated text ──

      // If spec wasn't detected during streaming (e.g. text arrived in chunks),

      // do a final scan of the complete accumulated text.

      try {

        if (accumulatedText) {

          const finalSpec = detectSpecBlock(accumulatedText, taskId);

          if (finalSpec) {

            const db_final = getDatabase();

            db_final.run(`UPDATE quest_tasks SET spec_content = ?, updated_at = datetime('now') WHERE id = ?`, [finalSpec, taskId]);

            saveDatabase().catch(() => {});

            sendQuestEvent({ type: 'spec_generated', taskId, specContent: finalSpec });

          }

        }

      } catch { /* final spec detection is non-critical */ }

      saveTaskMessages(taskId, agent);

      // Auto memory: post-task summarization

      if (config?.autoMemory) {

        const msgs = agent.getConversation().messages;

        summarizeConversation(provider!, msgs, workDir, getDatabase, saveDatabase).catch(() => {});

      }

      try {

        const db2 = getDatabase();

        db2.run(`UPDATE quest_tasks SET status = 'completed', updated_at = datetime('now') WHERE id = ?`, [taskId]);

        saveDatabase().catch(() => {});

      } catch { /* ignore */ }

      clearSpecTracker(taskId);

      sendQuestEvent({ type: 'status_change', taskId, status: 'completed', runId });

    } catch (error) {

      const msg = error instanceof Error ? error.message : String(error);

      const errName = error instanceof Error ? error.name : '';

      

      // Check if this is a normal abort (not an actual error)

      const isAbortError = errName === 'AbortError' || 

                           msg === 'Aborted' ||

                           msg.includes('aborted') ||

                           msg.includes('abort');

      

      if (!isAbortError) {

        // Real error — save progress, mark failed

        // NOTE: error + done events are already emitted by the Agent itself

        try {

          saveTaskMessages(taskId, agent);

        } catch { /* ignore */ }

        try {

          const db2 = getDatabase();

          db2.run(`UPDATE quest_tasks SET status = 'failed', updated_at = datetime('now') WHERE id = ?`, [taskId]);

          await saveDatabase();

        } catch { /* ignore */ }

        clearSpecTracker(taskId);

        sendQuestEvent({ type: 'status_change', taskId, status: 'failed', runId });

      }

      // Abort errors: status is handled by the caller (stopOnSwitch / pause / abort)

    } finally {

      // Guard: only clean up if this agent is still the current one for the task

      const current = taskAgents.get(taskId);

      if (current && (!current.runId || current.runId === runId)) {

        taskAgents.delete(taskId);

      }

    }

  });



  // --- Quest Stop on Switch (clean exit without marking failed) ---



  ipcMain.handle('quest:stop-on-switch', async (_event, { taskId, runId }: { taskId: string; runId?: string }) => {

    const taskAgent = taskAgents.get(taskId);

    if (taskAgent) {

      // runId guard: only stop if the provided runId matches the current agent's runId.
      // If no runId was provided (undefined), we cannot safely identify the target run —
      // aborting would risk killing a newly-started agent after a quick mode toggle.
      // In that case, skip the abort and let the agent continue or time out naturally.
      if (!runId) {
        return { success: false, reason: 'no_runId_guard' };
      }

      if (taskAgent.runId && taskAgent.runId !== runId) {

        return { success: false, reason: 'stale_runId' };

      }

      // Save messages before stopping

      try {

        saveTaskMessages(taskId, taskAgent.agent);

      } catch { /* ignore */ }

      taskAgent.abortController.abort();

      if (taskAgent.worktreePath) {

        try { await removeWorktree(getWorkspace(), taskAgent.worktreePath); } catch { /* ignore */ }

      }

      if (taskAgent.containerId) {

        removeContainer(taskAgent.containerId).catch(() => {});

      }

      taskAgents.delete(taskId);

    }



    // Set status to idle (not failed — user just switched away)

    try {

      const db = getDatabase();

      db.run(`UPDATE quest_tasks SET status = 'idle', updated_at = datetime('now') WHERE id = ?`, [taskId]);

      await saveDatabase();

    } catch { /* ignore */ }

    clearSpecTracker(taskId);

    sendQuestEvent({ type: 'done', taskId, runId });

    sendQuestEvent({ type: 'status_change', taskId, status: 'idle', runId });



    return { success: true };

  });



  // --- Quest User Interaction ---



  ipcMain.handle('quest:confirm:reply', async (_event, {

    requestId, approved, feedback,

  }: { requestId: string; approved: boolean; feedback?: string }) => {

    const resolve = pendingConfirmation.get(requestId);

    if (resolve) {

      resolve({ approved, feedback });

      pendingConfirmation.delete(requestId);

    }

  });



  ipcMain.handle('quest:ask-user:reply', async (_event, {

    requestId, answer,

  }: { requestId: string; answer: string }) => {

    const resolve = pendingAskUser.get(requestId);

    if (resolve) {

      resolve(answer);

      pendingAskUser.delete(requestId);

    }

  });



  ipcMain.handle('quest:intervention', async (_event, { taskId, text }: { taskId: string; text: string }) => {

    const taskAgent = taskAgents.get(taskId);

    if (taskAgent && text.trim()) {

      taskAgent.agent.injectIntervention(text.trim());

      return { success: true };

    }

    return { success: false };

  });



  // Save task messages to database (manual trigger from frontend)

  ipcMain.handle('quest:save-messages', async (_event, { taskId }: { taskId: string }) => {

    const taskAgent = taskAgents.get(taskId);

    if (taskAgent) {

      saveTaskMessages(taskId, taskAgent.agent);

    }

    return { success: true };

  });





  // --- Quest Cleanup (external abort without marking failed) ---



  ipcMain.handle('quest:cleanup', async (_event, { taskId }: { taskId: string }) => {

    const taskAgent = taskAgents.get(taskId);

    if (taskAgent) {

      try {

        saveTaskMessages(taskId, taskAgent.agent);

      } catch { /* ignore */ }

      taskAgent.abortController.abort();

      if (taskAgent.worktreePath) {

        try { await removeWorktree(getWorkspace(), taskAgent.worktreePath); } catch { /* ignore */ }

      }

      if (taskAgent.containerId) {

        removeContainer(taskAgent.containerId).catch(() => {});

      }

      taskAgents.delete(taskId);

    }



    // Set status to idle (not failed - clean exit)

    try {

      const db = getDatabase();

      db.run("UPDATE quest_tasks SET status = 'idle', updated_at = datetime('now') WHERE id = ?", [taskId]);

      await saveDatabase();

    } catch { /* ignore */ }

    clearSpecTracker(taskId);

    clearPreviewUrlTracker(taskId);

    sendQuestEvent({ type: 'done', taskId });

    sendQuestEvent({ type: 'status_change', taskId, status: 'idle' });



    return { success: true };

  });

  // --- Diff Review (reuse existing handlers, they work for both modes) ---

}





// --- Quest State Persistence Integration ---



async function persistQuestState(taskId: string, taskAgent: { agent: Agent; abortController: AbortController; worktreePath?: string; containerId?: string; runId?: string }): Promise<void> {

  try {

    const state: any = {

      taskId,

      status: 'running',

      createdAt: Date.now(),

      updatedAt: Date.now(),

      conversation: taskAgent.agent.getConversation ? taskAgent.agent.getConversation() : undefined,

      context: (taskAgent.agent as any).getContext ? (taskAgent.agent as any).getContext() : undefined,

      metadata: {

        worktreePath: taskAgent.worktreePath,

        containerId: taskAgent.containerId,

        runId: taskAgent.runId

      }

    };



    await questStateManager.saveState(state);

  } catch (error) {

    console.error('[Quest] Failed to persist state:', error);

  }

}





// --- Cross-module helpers (used by agent-ipc) ---



/** Abort all running Quest agents (called when Agent mode starts) */

export function abortAllQuestAgents(): void {

  for (const [taskId, taskAgent] of taskAgents) {

    try {

      saveTaskMessages(taskId, taskAgent.agent);

    } catch { /* ignore */ }

    taskAgent.abortController.abort();

    if (taskAgent.worktreePath && _getWorkspace) {

      try { removeWorktree(_getWorkspace(), taskAgent.worktreePath).catch(() => {}); } catch { /* ignore */ }

    }

    if (taskAgent.containerId) {

      removeContainer(taskAgent.containerId).catch(() => {});

    }

  }

  taskAgents.clear();

}

// --- Helpers ---



/**

 * Fix conversation integrity after abort: pad missing tool results.

 * When an agent is aborted mid-tool-execution, the conversation may have an assistant

 * message with N toolCalls but fewer than N tool result messages. Most LLM APIs reject

 * this invalid sequence. This function inserts synthetic tool results for the missing ones.

 */

function fixConversationIntegrity(messages: Message[]): Message[] {

  const result: Message[] = [];

  let i = 0;

  while (i < messages.length) {

    const msg = messages[i];

    result.push(msg);



    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {

      // Collect following tool results

      const expectedIds = new Set(msg.toolCalls.map((tc: any) => tc.id));

      const foundIds = new Set<string>();



      i++;

      while (i < messages.length && messages[i].role === 'tool') {

        const toolMsg = messages[i];

        result.push(toolMsg);

        foundIds.add((toolMsg as any).toolCallId || '');

        i++;

      }



      // Pad missing tool results so the LLM API doesn't reject the sequence

      for (const tcId of expectedIds) {

        if (!foundIds.has(tcId)) {

          result.push({

            role: 'tool',

            toolCallId: tcId,

            content: '[Tool execution was interrupted]',

          } as any);

        }

      }

      // i is already advanced past the tool messages

    } else {

      i++;

    }

  }

  return result;

}



/**

 * Fix empty toolCallId on tool messages by positional matching with the preceding

 * assistant message's toolCalls. This handles old DB records that didn't persist toolCallId.

 */

function fixToolCallIds(messages: Message[]): void {

  for (let i = 0; i < messages.length; i++) {

    const msg = messages[i];

    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {

      // Collect following tool messages

      const toolMsgs: Message[] = [];

      for (let j = i + 1; j < messages.length && messages[j].role === 'tool'; j++) {

        toolMsgs.push(messages[j]);

      }

      // Positional match: assign toolCallId from assistant's toolCalls

      for (let k = 0; k < Math.min(msg.toolCalls.length, toolMsgs.length); k++) {

        const tm = toolMsgs[k] as { role: 'tool'; toolCallId: string; content: string };

        if (!tm.toolCallId || tm.toolCallId === '') {

          tm.toolCallId = msg.toolCalls[k].id;

// @ts-expect-error - TS2554: Expected 0 arguments, but got 2
        }

      }

    }

  }

}



function saveTaskMessages(taskId: string, agent: Agent): void {

  try {

    const conversation = agent.getConversation();

    const messages = conversation.messages;

    const db = getDatabase();



    // Clear existing messages for this task

    db.run(`DELETE FROM quest_messages WHERE task_id = ?`, [taskId]);



    // Insert all messages

    for (const msg of messages) {

      const role = msg.role;

      let content = '';

      let toolCalls: string | null = null;



      if (role === 'user') {

        content = (msg as any).content || '';

      } else if (role === 'assistant') {

        content = (msg as any).content || '';

        if ((msg as any).toolCalls && (msg as any).toolCalls.length > 0) {

          toolCalls = JSON.stringify((msg as any).toolCalls);

        }

      } else if (role === 'tool') {

        content = (msg as any).content || '';

        // Persist toolCallId so it can be restored on resume

        if ((msg as any).toolCallId) {

          toolCalls = JSON.stringify({ toolCallId: (msg as any).toolCallId });

        }

      }



      db.run(

        `INSERT INTO quest_messages (task_id, role, content, tool_calls) VALUES (?, ?, ?, ?)`,

        [taskId, role, content, toolCalls]

      );

    }



    saveDatabase().catch(() => {});

  } catch {

    // Silently ignore message save errors

  }

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

    case 'done':

      return { type: 'done' };

    default:

      if ((event as any).type === 'heartbeat') return { type: 'heartbeat', turn: (event as any).turn, elapsedMs: (event as any).elapsedMs };

      return { type: 'unknown' };

  }

}

