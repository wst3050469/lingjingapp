// Web Server for mobile access
// Provides HTTP API and WebSocket for remote control

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'crypto';
import type { BrowserWindow } from 'electron';
import { app as electronApp } from 'electron';
import { join, dirname, relative, resolve } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';


interface WebServerConfig {
  enabled: boolean;
  port: number;
  token: string;
  frpEnabled: boolean;
  frpServerAddr: string;
  frpServerPort: number;
  frpRemotePort: number;
  frpToken: string;
  frpCustomDomain: string;
}

let serverConfig: WebServerConfig = {
  enabled: false,
  port: 3001,
  token: '',
  frpEnabled: false,
  frpServerAddr: 'wap.zhejiangjinmo.com',
  frpServerPort: 32200,
  frpRemotePort: 8080,
  frpToken: '',
  frpCustomDomain: '',
};

let httpServer: ReturnType<typeof createServer> | null = null;
let wss: WebSocketServer | null = null;
let activeConnections: Set<WebSocket> = new Set();

// ═══ Diagnostics ═══
export interface WebServerDiagnostics {
  startAttempted: boolean;
  startSucceeded: boolean;
  functionsInitialized: boolean;
  errors: Array<{ stage: string; message: string; time: string }>;
  configLoaded: boolean;
  currentPort: number;
  listenAttempts: number;
}

let wsDiagnostics: WebServerDiagnostics = {
  startAttempted: false,
  startSucceeded: false,
  functionsInitialized: false,
  errors: [],
  configLoaded: false,
  currentPort: 3001,
  listenAttempts: 0,
};

function recordError(stage: string, message: string): void {
  wsDiagnostics.errors.push({ stage, message, time: new Date().toISOString() });
  console.error(`[Web Server] [${stage}] ${message}`);
}

// Store references to main process functions
let getMainWindowFn: (() => BrowserWindow | null) | null = null;
let getDatabaseFn: (() => any) | null = null;
let saveDatabaseFn: (() => Promise<void>) | null = null;

/**
 * Initialize web server with main process function references
 * Call this once during app startup to avoid circular dependencies
 */
export function initWebServerFunctions(
  getMainWindow: () => BrowserWindow | null,
  getDatabase: () => any,
  saveDatabase: () => Promise<void>
): void {
  getMainWindowFn = getMainWindow;
  getDatabaseFn = getDatabase;
  saveDatabaseFn = saveDatabase;
  wsDiagnostics.functionsInitialized = true;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function safeParseJson(str: any, fallback: any): any {
  if (typeof str !== 'string') return str ?? fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

export function startWebServer(config: Partial<WebServerConfig> = {}): void {
  wsDiagnostics.startAttempted = true;
  wsDiagnostics.listenAttempts = 0;
  wsDiagnostics.errors = [];

  if (httpServer) {
    console.log('[Web Server] Server already running');
    wsDiagnostics.startSucceeded = true;
    return;
  }

  serverConfig = { ...serverConfig, ...config };
  wsDiagnostics.configLoaded = true;

  if (!serverConfig.token) {
    serverConfig.token = generateToken();
  }

  if (!getMainWindowFn || !getDatabaseFn || !saveDatabaseFn) {
    recordError('init-check', 'Main process functions not initialized. Call initWebServerFunctions() first.');
    return;
  }

  const expressApp = express();
  
    // CORS for mobile access - restrict origins to localhost + FRP domain
  expressApp.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const allowedOrigins = ['http://localhost', 'http://127.0.0.1', 'https://' + serverConfig.frpServerAddr, 'http://' + serverConfig.frpServerAddr];
    const isAllowed = allowedOrigins.some(a => origin.startsWith(a) || origin === 'null');
    res.header('Access-Control-Allow-Origin', isAllowed ? origin : 'http://localhost');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });  // so that module scripts with crossorigin attribute get proper headers
  

  // Serve mobile web UI (static files)
  // Support both dev mode and packaged app
  const isPackaged = electronApp.isPackaged;
  const mobileDistPath = isPackaged
    ? join(process.resourcesPath, 'lingjing-mobile', 'dist')
    : join(__dirname, '../../../../lingjing-mobile/dist');
  
  if (existsSync(mobileDistPath)) {
    const indexPath = join(mobileDistPath, 'index.html');
    
    // Serve index.html with token auto-injected so mobile clients
    // don't need to manually copy it from desktop settings
    expressApp.get(['/', '/index.html'], (req, res) => {
      try {
        let html = readFileSync(indexPath, 'utf-8');
        if (serverConfig.token) {
          const injectScript = `<script>window.__LINGJING_TOKEN__="${serverConfig.token}";</script>`;
          html = html.replace('<script type="module"', injectScript + '\n    <script type="module"');
        }
        res.type('html').send(html);
      } catch (err) {
        console.error('[Web Server] Failed to serve mobile HTML:', err);
        res.status(500).send('Internal Server Error');
      }
    });
    
    // Serve static assets (JS, CSS, etc.)
    expressApp.use('/', express.static(mobileDistPath, {
      index: false,
      maxAge: '1d',
    }));
    console.log('[Web Server] Mobile UI served at /');
  }
  
  // Middleware
  expressApp.use(express.json());
  
  // Auth middleware
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== serverConfig.token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };

  // Health check
  expressApp.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get current tasks
  expressApp.get('/api/tasks', authenticate, (req, res) => {
    try {
      const db = getDatabaseFn!();
      const tasks = db.exec('SELECT * FROM quest_tasks ORDER BY created_at DESC LIMIT 20');
      res.json(tasks[0]?.values.map((row: any) => ({
        id: row[0],
        title: row[3],
        status: row[6],
        createdAt: row[7],
      })) || []);
    } catch (err) {
      console.error('[Web Server] Failed to get tasks:', err);
      res.status(500).json({ error: 'Failed to get tasks' });
    }
  });

  // Alias: /api/quest-tasks (mobile-compatible endpoint name)
  expressApp.get('/api/quest-tasks', authenticate, (req, res) => {
    try {
      const db = getDatabaseFn!();
      const tasks = db.exec('SELECT * FROM quest_tasks ORDER BY created_at DESC LIMIT 20');
      res.json(tasks[0]?.values.map((row: any) => ({
        id: row[0],
        title: row[3],
        status: row[6],
        createdAt: row[7],
      })) || []);
    } catch (err) {
      console.error('[Web Server] /api/quest-tasks error:', err);
      res.status(500).json({ error: 'Failed to get tasks' });
    }
  });

  // Create new quest task
  expressApp.post('/api/quest', authenticate, async (req, res) => {
    try {
      const { message, scenario = 'spec', runMode = 'local', autoMode = 'auto' } = req.body;
      
      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const db = getDatabaseFn!();
      const id = `quest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const title = message.slice(0, 50);
      
      db.run(
        `INSERT INTO quest_tasks (id, user_id, title, scenario, run_mode, auto_mode, status) VALUES (?, 1, ?, ?, ?, ?, 'idle')`,
        [id, title, scenario, runMode, autoMode]
      );
      await saveDatabaseFn!();

      // Send to renderer
      const mainWindow = getMainWindowFn!();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('quest:create-from-mobile', {
          taskId: id,
          message,
          scenario,
          runMode,
          autoMode,
        });
      }

      res.json({ taskId: id, status: 'created' });
    } catch (err) {
      console.error('[Web Server] Failed to create quest:', err);
      res.status(500).json({ error: 'Failed to create quest' });
    }
  });

  // Get task status
  expressApp.get('/api/quest/:taskId', authenticate, (req, res) => {
    try {
      const db = getDatabaseFn!();
      const task = db.exec(`SELECT * FROM quest_tasks WHERE id = ?`, [req.params.taskId]);
      if (task[0]?.values.length > 0) {
        const row = task[0].values[0];
        res.json({
          id: row[0],
          title: row[3],
          status: row[6],
          createdAt: row[7],
        });
      } else {
        res.status(404).json({ error: 'Task not found' });
      }
    } catch (err) {
      res.status(500).json({ error: 'Failed to get task' });
    }
  });

  // Cancel task
  expressApp.post('/api/quest/:taskId/cancel', authenticate, (req, res) => {
    try {
      const mainWindow = getMainWindowFn!();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('quest:cancel-from-mobile', { taskId: req.params.taskId });
      }
      res.json({ status: 'cancelled' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to cancel task' });
    }
  });

  // ─── Mobile API: Sessions (AI 对话) ───
  // List all conversations with last message preview
  expressApp.get('/api/sessions', authenticate, (req, res) => {
    try {
      const db = getDatabaseFn!();
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      
      const rows = db.exec(
        `SELECT c.id, c.title, c.created_at, c.updated_at,
          (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) as last_message
         FROM conversations c ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      
      const sessions = (rows[0]?.values || []).map((row: any) => ({
        id: row[0],
        title: row[1] || '新对话',
        created_at: row[2],
        updated_at: row[3],
        last_message: row[4] ? row[4].slice(0, 100) : null,
      }));
      
      res.json({ sessions, total: sessions.length });
    } catch (err) {
      console.error('[Web Server] /api/sessions error:', err);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  });

  // Create new conversation (from mobile)
  expressApp.post('/api/sessions', authenticate, async (req, res) => {
    try {
      const { title, message } = req.body;
      const db = getDatabaseFn!();
      const id = `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const convTitle = title || (message ? message.slice(0, 50) : '新对话');

      db.run(
        `INSERT INTO conversations (id, title) VALUES (?, ?)`,
        [id, convTitle]
      );

      // Insert initial message if provided
      if (message) {
        db.run(
          `INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)`,
          [id, message]
        );
      }

      await saveDatabaseFn!();
      res.json({ id, title: convTitle, created_at: new Date().toISOString() });
    } catch (err) {
      console.error('[Web Server] POST /api/sessions error:', err);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // Get conversation detail with messages
  expressApp.get('/api/sessions/:id', authenticate, (req, res) => {
    try {
      const db = getDatabaseFn!();
      const conv = db.exec(`SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?`, [req.params.id]);
      if (!conv[0]?.values.length) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      const c = conv[0].values[0];
      
      const msgs = db.exec(
        `SELECT id, role, content, tool_calls, created_at FROM messages 
         WHERE conversation_id = ? ORDER BY id ASC LIMIT 100`,
        [req.params.id]
      );
      
      const messages = (msgs[0]?.values || []).map((row: any) => ({
        id: row[0],
        role: row[1],
        content: row[2],
        tool_calls: safeParseJson(row[3], null),
        created_at: row[4],
      }));
      
      res.json({
        id: c[0], title: c[1] || '新对话',
        created_at: c[2], updated_at: c[3],
        messages,
      });
    } catch (err) {
      console.error('[Web Server] /api/sessions/:id error:', err);
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  // Send message to existing conversation (triggers AI response)
  expressApp.post('/api/sessions/:id/send', authenticate, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) { res.status(400).json({ error: 'message is required' }); return; }
      
      const db = getDatabaseFn!();
      const conv = db.exec(`SELECT id FROM conversations WHERE id = ?`, [req.params.id]);
      if (!conv[0]?.values.length) {
        res.status(404).json({ error: 'Session not found' }); return;
      }
      
      // Insert user message
      db.run(`INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)`,
        [req.params.id, message]);
      
      // Update conversation timestamp
      db.run(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`, [req.params.id]);
      await saveDatabaseFn!();
      
      // Send to renderer to trigger AI response
      const mainWindow = getMainWindowFn!();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat:send-from-mobile', {
          conversationId: req.params.id,
          message,
        });
      }
      
      res.json({ status: 'sent', conversationId: req.params.id });
    } catch (err) {
      console.error('[Web Server] POST /api/sessions/:id/send error:', err);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // ─── Mobile API: Plans (计划) ───
  expressApp.get('/api/plans', authenticate, (req, res) => {
    try {
      const db = getDatabaseFn!();
      const rows = db.exec(
        `SELECT id, title, description, status, current_step_index, working_directory, created_at, updated_at
         FROM plans ORDER BY updated_at DESC LIMIT 20`
      );
      const plans = (rows[0]?.values || []).map((row: any) => ({
        id: row[0], title: row[1], description: row[2]?.slice(0, 200),
        status: row[3], current_step: row[4], working_directory: row[5],
        created_at: row[6], updated_at: row[7],
      }));
      res.json({ plans });
    } catch (err) {
      console.error('[Web Server] /api/plans error:', err);
      res.status(500).json({ error: 'Failed to list plans' });
    }
  });

  expressApp.get('/api/plans/:id', authenticate, (req, res) => {
    try {
      const db = getDatabaseFn!();
      const plan = db.exec(`SELECT * FROM plans WHERE id = ?`, [req.params.id]);
      if (!plan[0]?.values.length) {
        res.status(404).json({ error: 'Plan not found' }); return;
      }
      const p = plan[0].values[0];
      
      const steps = db.exec(
        `SELECT id, step_index, title, description, status, estimated_complexity, result
         FROM plan_steps WHERE plan_id = ? ORDER BY step_index ASC`,
        [req.params.id]
      );
      
      res.json({
        id: p[0], title: p[1], description: p[2],
        goals: safeParseJson(p[3], []), constraints: safeParseJson(p[4], []),
        status: p[5], current_step: p[6], working_directory: p[7],
        retrospective: p[8], created_at: p[9], updated_at: p[10],
        steps: (steps[0]?.values || []).map((s: any) => ({
          id: s[0], step_index: s[1], title: s[2], description: s[3],
          status: s[4], complexity: s[5], result: s[6],
        })),
      });
    } catch (err) {
      console.error('[Web Server] /api/plans/:id error:', err);
      res.status(500).json({ error: 'Failed to get plan' });
    }
  });

  // ─── Mobile API: Device Status ───
  expressApp.get('/api/status', authenticate, (req, res) => {
    try {
      const os = require('os');
      const db = getDatabaseFn!();
      const convCount = db.exec(`SELECT COUNT(*) FROM conversations`)[0]?.values[0][0] || 0;
      const questCount = db.exec(`SELECT COUNT(*) FROM quest_tasks`)[0]?.values[0][0] || 0;
      const planCount = db.exec(`SELECT COUNT(*) FROM plans`)[0]?.values[0][0] || 0;
      
      res.json({
        device: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: Math.floor(os.uptime()),
        memory: {
          total: Math.round(os.totalmem() / 1024 / 1024),
          free: Math.round(os.freemem() / 1024 / 1024),
        },
        cpu: os.cpus().length + ' cores',
        stats: {
          conversations: convCount,
          quest_tasks: questCount,
          plans: planCount,
          mobile_clients: activeConnections.size,
        },
        version: (() => { try { return require('../../package.json').version; } catch { return '1.3.1'; } })() || '1.3.1',
        server_time: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Web Server] /api/status error:', err);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // ─── Mobile API: Memories ───
  expressApp.get('/api/memories', authenticate, (req, res) => {
    try {
      const db = getDatabaseFn!();
      const rows = db.exec(
        `SELECT id, scope, category, title, content, source, created_at, updated_at
         FROM memories ORDER BY updated_at DESC LIMIT 50`
      );
      const memories = (rows[0]?.values || []).map((row: any) => ({
        id: row[0], scope: row[1], category: row[2],
        title: row[3], content: row[4]?.slice(0, 300),
        source: row[5], created_at: row[6], updated_at: row[7],
      }));
      res.json({ memories });
    } catch (err) {
      console.error('[Web Server] /api/memories error:', err);
      res.status(500).json({ error: 'Failed to list memories' });
    }
  });

  // Create HTTP server
  httpServer = createServer(expressApp);

  // WebSocket server for real-time updates
  wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws',
  });
  setupWssConnections(wss);

  // ── WebSocket Command Handler ──
  function handleWsCommand(ws: WebSocket, msg: any) {
    const { id, channel, action, payload = {} } = msg;
    
    try {
      const db = getDatabaseFn!();
      
      switch (channel) {
        case 'chat': handleChatCommand(ws, id, action, payload, db); break;
        case 'quest': handleQuestCommand(ws, id, action, payload, db); break;
        case 'plan': handlePlanCommand(ws, id, action, payload, db); break;
        case 'memory': handleMemoryCommand(ws, id, action, payload, db); break;
        case 'status': handleStatusCommand(ws, id, action, payload); break;
        case 'file': handleFileCommand(ws, id, action, payload); break;
        default:
          ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Unknown channel: ' + channel }));
      }
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'ack', id, success: false, error: err.message }));
    }
  }

  function handleChatCommand(ws: WebSocket, id: string, action: string, payload: any, db: any) {
    if (action === 'list') {
      const rows = db.exec(`SELECT id, title, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 30`);
      const sessions = (rows[0]?.values || []).map((r: any) => ({ id: r[0], title: r[1] || '新对话', updated_at: r[2] }));
      ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { sessions } }));
    } else if (action === 'get') {
      const conv = db.exec(`SELECT id, title, created_at FROM conversations WHERE id = ?`, [payload.id]);
      if (!conv[0]?.values.length) {
        ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Not found' })); return;
      }
      const msgs = db.exec(`SELECT role, content, tool_calls, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 50`, [payload.id]);
      ws.send(JSON.stringify({
        type: 'ack', id, success: true,
        data: { id: conv[0].values[0][0], title: conv[0].values[0][1], messages: (msgs[0]?.values || []).map((m: any) => ({ role: m[0], content: m[1], tool_calls: safeParseJson(m[2], null), created_at: m[3] })) }
      }));
    } else if (action === 'send') {
      db.run(`INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)`, [payload.conversationId, payload.message]);
      db.run(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`, [payload.conversationId]);
      saveDatabaseFn!().then(() => {
        const mainWindow = getMainWindowFn!();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat:send-from-mobile', { conversationId: payload.conversationId, message: payload.message });
        }
      });
      ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { status: 'sent' } }));
    } else if (action === 'subscribe') {
      // Client wants real-time push for chat events. Just ack - push happens via broadcastToMobile()
      ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { subscribed: true, channel: 'chat' } }));
    } else {
      ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Unknown action: ' + action }));
    }
  }

  function handleQuestCommand(ws: WebSocket, id: string, action: string, payload: any, db: any) {
    if (action === 'list') {
      const rows = db.exec(`SELECT id, title, status, scenario, created_at FROM quest_tasks ORDER BY created_at DESC LIMIT 30`);
      const tasks = (rows[0]?.values || []).map((r: any) => ({ id: r[0], title: r[1], status: r[2], scenario: r[3], created_at: r[4] }));
      ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { tasks } }));
    } else if (action === 'get') {
      const task = db.exec(`SELECT * FROM quest_tasks WHERE id = ?`, [payload.id]);
      if (!task[0]?.values.length) {
        ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Not found' })); return;
      }
      const t = task[0].values[0];
      const msgs = db.exec(`SELECT role, content, created_at FROM quest_messages WHERE task_id = ? ORDER BY id ASC LIMIT 50`, [payload.id]);
      ws.send(JSON.stringify({
        type: 'ack', id, success: true,
        data: {
          id: t[0], title: t[2], status: t[5], scenario: t[3],
          spec_content: t[7], created_at: t[8], updated_at: t[9],
          messages: (msgs[0]?.values || []).map((m: any) => ({ role: m[0], content: m[1], created_at: m[2] })),
        }
      }));
    } else if (action === 'subscribe') {
      ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { subscribed: true, channel: 'quest' } }));
    } else {
      ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Unknown action' }));
    }
  }

  function handlePlanCommand(ws: WebSocket, id: string, action: string, payload: any, db: any) {
    if (action === 'list') {
      const rows = db.exec(`SELECT id, title, status, created_at FROM plans ORDER BY created_at DESC LIMIT 20`);
      const plans = (rows[0]?.values || []).map((r: any) => ({ id: r[0], title: r[1], status: r[2], created_at: r[3] }));
      ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { plans } }));
    } else if (action === 'get') {
      const plan = db.exec(`SELECT * FROM plans WHERE id = ?`, [payload.id]);
      if (!plan[0]?.values.length) {
        ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Not found' })); return;
      }
      const p = plan[0].values[0];
      const steps = db.exec(`SELECT step_index, title, status FROM plan_steps WHERE plan_id = ? ORDER BY step_index ASC`, [payload.id]);
      ws.send(JSON.stringify({
        type: 'ack', id, success: true,
        data: {
          id: p[0], title: p[1], description: p[2],
          goals: safeParseJson(p[3], []), status: p[5], current_step: p[6],
          created_at: p[9], updated_at: p[10],
          steps: (steps[0]?.values || []).map((s: any) => ({ index: s[0], title: s[1], status: s[2] })),
        }
      }));
    } else if (action === 'subscribe') {
      ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { subscribed: true, channel: 'plan' } }));
    } else {
      ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Unknown action' }));
    }
  }

  function handleMemoryCommand(ws: WebSocket, id: string, action: string, payload: any, db: any) {
    if (action === 'list') {
      const rows = db.exec(`SELECT id, scope, category, title, content, created_at FROM memories ORDER BY updated_at DESC LIMIT 50`);
      const memories = (rows[0]?.values || []).map((r: any) => ({ id: r[0], scope: r[1], category: r[2], title: r[3], content: r[4]?.slice(0, 300), created_at: r[5] }));
      ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { memories } }));
    } else {
      ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Unknown action' }));
    }
  }

  function handleStatusCommand(ws: WebSocket, id: string, action: string, payload: any) {
    const os = require('os');
    const db = getDatabaseFn!();
    ws.send(JSON.stringify({
      type: 'ack', id, success: true,
      data: {
        device: os.hostname(), platform: os.platform(),
        uptime: Math.floor(os.uptime()),
        memory: { total: Math.round(os.totalmem() / 1024 / 1024), free: Math.round(os.freemem() / 1024 / 1024) },
        cpu: os.cpus().length + ' cores',
        stats: {
          conversations: db.exec(`SELECT COUNT(*) FROM conversations`)[0]?.values[0][0] || 0,
          quest_tasks: db.exec(`SELECT COUNT(*) FROM quest_tasks`)[0]?.values[0][0] || 0,
          plans: db.exec(`SELECT COUNT(*) FROM plans`)[0]?.values[0][0] || 0,
          mobile_clients: activeConnections.size,
        },
      }
    }));
  }

  // ── File System Browsing for Mobile FileTreeScreen ──
  function handleFileCommand(ws: WebSocket, id: string, action: string, payload: any) {
    try {
      if (action === 'list') {
        const dirPath = payload.path || process.cwd();
        const entries = readdirSync(dirPath).map((name) => {
          const fullPath = resolve(dirPath, name);
          try {
            const s = statSync(fullPath);
            return {
              name,
              path: fullPath,
              type: s.isDirectory() ? 'dir' : 'file',
              size: s.isFile() ? s.size : undefined,
            };
          } catch {
            return { name, path: fullPath, type: 'file' as const };
          }
        });
        ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { entries, path: dirPath } }));
      } else if (action === 'read') {
        const content = readFileSync(payload.path, 'utf-8');
        ws.send(JSON.stringify({ type: 'ack', id, success: true, data: { content, path: payload.path } }));
      } else {
        ws.send(JSON.stringify({ type: 'ack', id, success: false, error: 'Unknown file action: ' + action }));
      }
    } catch (err: any) {
      ws.send(JSON.stringify({ type: 'ack', id, success: false, error: err.message }));
    }
  }

  // ── setupWssConnections: reusable function to attach WebSocket handlers ──
  // Called both on initial server creation and on port-retry fallback
  function setupWssConnections(wsServer: WebSocketServer): void {
    wsServer.on('connection', (ws: WebSocket, req) => {
      const token = new URL(req.url || '', 'http://localhost').searchParams.get('token');
      
      if (token !== serverConfig.token) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      activeConnections.add(ws);
      console.log('[Web Server] WebSocket client connected');

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          
          // ── Heartbeat ──
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            return;
          }
          
          // ── Structured command ──
          if (msg.type === 'cmd') {
            handleWsCommand(ws, msg);
            return;
          }
          
          // Legacy: echo back for debugging
          ws.send(JSON.stringify({ type: 'echo', original: msg }));
        } catch (err) {
          console.error('[Web Server] Failed to parse WebSocket message:', err);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
      });

      ws.on('close', () => {
        activeConnections.delete(ws);
        console.log('[Web Server] WebSocket client disconnected');
      });
    });
  }

  // Start listening with port fallback if EADDRINUSE
  // Use a helper to register error handler in a way esbuild leaves alone
  function tryListenPort(port: number, maxRetries: number): void {
    wsDiagnostics.listenAttempts++;
    const srv = httpServer!;
    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && maxRetries > 0) {
        recordError('port-busy', `Port ${port} is in use, trying ${port + 1}`);
        console.error(`[Web Server] Port ${port} is already in use. Trying port ${port + 1}...`);
        // Register handler for next attempt BEFORE listen call
        const srv2 = createServer(expressApp);
        httpServer = srv2;
        // Re-attach WebSocket to new server with full handler setup
        wss?.close();
        wss = new WebSocketServer({ server: srv2, path: '/ws' });
        setupWssConnections(wss);
        tryListenPort(port + 1, maxRetries - 1);
      } else {
        const msg = err.code === 'EADDRINUSE' ? `All ports busy (tried up to ${wsDiagnostics.currentPort + wsDiagnostics.listenAttempts - 1})` : err.message;
        recordError('listen-fail', msg);
        console.error('[Web Server] Failed to start:', err.message);
        // Clean up: set httpServer to null so isWebServerRunning() reflects reality
        httpServer = null;
        if (wss) {
          wss.close();
          wss = null;
        }
      }
    };
    // Register error handler BEFORE listen - the 'error' event is async
    srv.addListener('error', onError);
    try {
      srv.listen(port, '0.0.0.0', () => {
        srv.removeListener('error', onError);
        serverConfig.port = port;
        wsDiagnostics.currentPort = port;
        wsDiagnostics.startSucceeded = true;
        wsDiagnostics.configLoaded = true;
        console.log(`[Web Server] Server started on port ${port}`);
        console.log(`[Web Server] Local access: http://localhost:${port}`);
        if (serverConfig.frpEnabled) {
          console.log(`[Web Server] Remote access: http://${serverConfig.frpServerAddr}:${serverConfig.frpRemotePort}`);
        }
        console.log(`[Web Server] Token: ${serverConfig.token}`);
      });
    } catch (err: any) {
      // Newer Node.js throws EADDRINUSE synchronously
      srv.removeListener('error', onError);
      onError(err);
    }
  }

  tryListenPort(serverConfig.port, 5);
}

export function stopWebServer(): Promise<void> {
  // Close WebSocket server first - this forcefully drops all WS connections
  if (wss) {
    try {
      // Force-close all connected clients
      activeConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1001, 'Server shutting down');
        }
      });
      wss.close();
    } catch (err: any) {
      console.error('[Web Server] Error closing wss:', err.message);
    }
    wss = null;
  }
  
  activeConnections.clear();

  return new Promise<void>((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }
    
    try {
      // Close all idle keep-alive connections first (Node 18.2+)
      if (typeof (httpServer as any).closeAllConnections === 'function') {
        (httpServer as any).closeAllConnections();
      }
      httpServer.close((err?: Error) => {
        if (err) {
          console.error('[Web Server] Error closing server:', err.message);
        } else {
          console.log('[Web Server] Server stopped');
        }
        httpServer = null;
        resolve();
      });
    } catch (err: any) {
      console.error('[Web Server] Error during server shutdown:', err.message);
      httpServer = null;
      resolve();
    }
  });
}

export function broadcastToMobile(event: any): void {
  if (activeConnections.size === 0) return;
  
  const message = JSON.stringify(event);
  activeConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

export function getServerConfig(): WebServerConfig {
  return serverConfig;
}

export function getDiagnostics(): WebServerDiagnostics {
  return { ...wsDiagnostics, errors: [...wsDiagnostics.errors] };
}

export function isWebServerRunning(): boolean {
  return httpServer !== null && httpServer.listening;
}

export function getAccessUrls(): { local: string; remote?: string } {
  const local = `http://localhost:${serverConfig.port}`;
  // With Nginx reverse proxy + SSL, users access https://wap.zhejiangjinmo.com (no port needed)
  const remote = serverConfig.frpEnabled 
    ? `https://${serverConfig.frpServerAddr}`
    : undefined;
  
  return { local, remote };
}
