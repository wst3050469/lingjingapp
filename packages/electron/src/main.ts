// CodePilot Electron main process entry point

import { app, BrowserWindow, ipcMain, shell, Menu, dialog, globalShortcut, session } from 'electron';
import { join, dirname } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { registerAgentIpc, initAgent, setWorkingDirectory, setSshTerminalId, reinitProvider } from './ipc/agent-ipc.js';
import { registerFsIpc } from './ipc/fs-ipc.js';
import { registerTerminalIpc, destroyAllTerminals } from './ipc/terminal-ipc.js';
import { registerMcpIpc, autoConnectMcpServers } from './ipc/mcp-ipc.js';
import { registerAuthIpc } from './ipc/auth-ipc.js';
import { registerOllamaIpc } from './ipc/ollama-ipc.js';
import { registerGitIpc } from './ipc/git-ipc.js';
import { registerMemoryIpc } from './ipc/memory-ipc.js';
import { registerSkillsIpc } from './ipc/skills-ipc.js';
import { registerSkillMarketIpc } from './ipc/skill-market-ipc.js';
import { registerIndexingIpc } from './ipc/indexing-ipc.js';
import { registerIntegrationsIpc } from './ipc/integrations-ipc.js';
import { registerNetworkIpc } from './ipc/network-ipc.js';
import { registerCompletionIpc, resetCompletionProvider } from './ipc/completion-ipc.js';
import { registerInlineChatIpc, resetInlineChatProvider } from './ipc/inline-chat-ipc.js';
import { registerCompactIpc, resetCompactProvider } from './ipc/compact-ipc.js';
import { registerPromptIpc, resetPolishProvider } from './ipc/prompt-ipc.js';
import { registerDiagnosticsIpc, shutdownLspServers } from './ipc/diagnostics-ipc.js';
import { registerQuestIpc, reinitQuestProvider, setQuestSshTerminalId } from './ipc/quest-ipc.js';
import { registerQuestStateIpc } from './ipc/quest-state-ipc.js';
import { registerWikiIpc } from './ipc/wiki-ipc.js';
import { initUpdateIPC, stopAutoCheck } from './ipc/update-ipc.js';
import { registerBrowserIpc } from './ipc/browser-ipc.js';
import { registerPlanIpc } from './ipc/plan-ipc.js';
import { registerContextIpc } from './ipc/context-ipc.js';
import { initDatabase, closeDatabase, getDatabase, saveDatabase, saveDatabaseSync } from './db/database.js';
import { registerSshIpc, destroyAllSshSessions, setSshTerminalChangeCallback } from './ssh/ssh-ipc.js';
import { initWebServerFunctions, startWebServer, stopWebServer, broadcastToMobile, isWebServerRunning, generateToken, getDiagnostics } from './web-server.js';
import { startFrpClient, stopFrpClient, getFrpStatus } from './frp-client.js';
import { registerCloudIpc, autoConnectCloud, pushMemoryToCloud, pushSessionToCloud } from './ipc/cloud-ipc.js';
import { registerScheduleIpc } from './ipc/schedule-ipc.js';
import { registerAdminIpc } from './ipc/admin-ipc.js';
import { initCloudSyncIpc } from './ipc/cloud-sync-ipc.js';
import { initGitHubIpc } from './ipc/github-ipc.js';
import { registerAllCloudManagementIpc } from './ipc/cloud-management/index.js';
import { registerFusionIPC, setFusionModules, setEventBus, setHookRegistry } from './ipc/fusion/index.js';
import { registerVoiceIPC } from './ipc/voice-ipc.js';
import { registerNewFeatureIPC } from './ipc/register-new-features.js';
import { VoiceEngineManager } from './voice/voice-engine-manager.js';
import { registerCheckpointIPC } from './ipc/checkpoint-ipc.js';
import { generateDeviceFingerprint } from './services/secure-storage.js';
import { registerWorkflowIPCWithDb } from './ipc/workflow-ipc.js';
import { verifyIpcRegistrations } from './ipc/ipc-verifier.js';
import { registerBatchIPC } from './ipc/batch-ipc.js';
import { registerConnectorIPC } from './ipc/connector-ipc.js';
import { registerTriggerIPC } from './ipc/trigger-ipc.js';

const IS_DEV = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function buildApplicationMenu(): Menu {
  const isMac = process.platform === 'darwin';
  const template: any[] = [];

  // File menu
  template.push({
    label: '文件',
    submenu: [
      {
        label: '新建文件',
        accelerator: 'CmdOrCtrl+N',
        click: () => mainWindow?.webContents.send('menu:new-file'),
      },
      {
        label: '新建窗口',
        accelerator: 'CmdOrCtrl+Shift+N',
        click: () => mainWindow?.webContents.send('menu:new-window'),
      },
      { type: 'separator' },
      {
        label: '打开文件...',
        accelerator: 'CmdOrCtrl+O',
        click: async () => {
          const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openFile'],
            title: '打开文件',
          });
          if (!result.canceled && result.filePaths.length > 0) {
            mainWindow?.webContents.send('menu:open-file', result.filePaths[0]);
          }
        },
      },
      {
        label: '打开文件夹...',
        accelerator: 'CmdOrCtrl+K CmdOrCtrl+O',
        click: async () => {
          const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openDirectory'],
            title: '打开文件夹',
          });
          if (!result.canceled && result.filePaths.length > 0) {
            mainWindow?.webContents.send('menu:open-folder', result.filePaths[0]);
          }
        },
      },
      { type: 'separator' },
      {
        label: '保存',
        accelerator: 'CmdOrCtrl+S',
        click: () => mainWindow?.webContents.send('menu:save'),
      },
      {
        label: '全部保存',
        accelerator: 'CmdOrCtrl+Shift+S',
        click: () => mainWindow?.webContents.send('menu:save-all'),
      },
      { type: 'separator' },
      {
        label: '自动保存',
        type: 'checkbox',
        checked: false,
        click: (item: any) => mainWindow?.webContents.send('menu:auto-save', item.checked),
      },
      { type: 'separator' },
      {
        label: '首选项',
        submenu: [
          {
            label: '设置',
            accelerator: 'CmdOrCtrl+,',
            click: () => mainWindow?.webContents.send('menu:open-settings'),
          },
        ],
      },
      { type: 'separator' },
      { role: 'quit', label: '退出' },
    ],
  });

  // Edit menu
  template.push({
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' },
    ],
  });

  // View menu
  template.push({
    label: '查看',
    submenu: [
      {
        label: '命令面板',
        accelerator: 'CmdOrCtrl+Shift+P',
        click: () => mainWindow?.webContents.send('menu:command-palette'),
      },
      { type: 'separator' },
      {
        label: '放大',
        accelerator: 'CmdOrCtrl+=',
        click: () => {
          if (mainWindow) {
            const current = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(current + 0.5);
          }
        },
      },
      {
        label: '缩小',
        accelerator: 'CmdOrCtrl+-',
        click: () => {
          if (mainWindow) {
            const current = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(current - 0.5);
          }
        },
      },
      {
        label: '重置缩放',
        accelerator: 'CmdOrCtrl+0',
        click: () => mainWindow?.webContents.setZoomLevel(0),
      },
      { type: 'separator' },
      { role: 'togglefullscreen', label: '全屏' },
    ],
  });

  // Help menu
  template.push({
    label: '帮助',
    submenu: [
      {
        label: '关于灵境',
        click: () => mainWindow?.webContents.send('menu:about'),
      },
    ],
  });

  return Menu.buildFromTemplate(template);
}

// Workspace path persisted in memory (loaded from config later)
// In packaged apps, process.cwd() is unreliable - default to user home
let workspacePath: string = app.isPackaged ? homedir() : process.cwd();

/**
 * Load workspace path from config file with comprehensive validation
 * @returns Valid workspace path, or default directory if validation fails
 */
async function loadWorkspaceFromConfig(): Promise<string> {
  const configPath = join(homedir(), '.lingjing', 'config.json');
  const defaultWorkspace = homedir();

  try {
    // 1. Check if config file exists
    if (!existsSync(configPath)) {
      console.log('[Main] Config file not found, using default workspace');
      return defaultWorkspace;
    }

    // 2. Read and parse config
    const raw = await readFile(configPath, 'utf8');
    let cfg: any;

    try {
      cfg = JSON.parse(raw);
    } catch (parseError) {
      console.error('[Main] Failed to parse config.json:', parseError);
      console.error('[Main] Config file content preview:', raw.substring(0, 200));
      return defaultWorkspace;
    }

    // 3. Validate field type
    if (typeof cfg.lastWorkspace !== 'string' || !cfg.lastWorkspace) {
      console.log('[Main] lastWorkspace field invalid or empty, using default');
      return defaultWorkspace;
    }

    const savedPath = cfg.lastWorkspace;

    // 4. Validate path existence
    if (!existsSync(savedPath)) {
      console.warn(`[Main] Saved workspace not found: ${savedPath}`);
      console.warn('[Main] Path may have been deleted or moved');

      // Clear invalid config
      try {
        cfg.lastWorkspace = '';
        await writeFile(configPath, JSON.stringify(cfg, null, 2), 'utf8');
        console.log('[Main] Cleared invalid lastWorkspace from config');
      } catch (writeError) {
        console.error('[Main] Failed to update config file:', writeError);
      }

      return defaultWorkspace;
    }

    // 5. Check if it's a directory (not a file)
    const stats = await (await import('node:fs/promises')).stat(savedPath);
    if (!stats.isDirectory()) {
      console.warn(`[Main] Saved path is not a directory: ${savedPath}`);
      return defaultWorkspace;
    }

    // 6. Check access permissions (read/write)
    try {
      const fsPromises = await import('node:fs/promises');
      const constants = (await import('node:fs')).constants;
      await fsPromises.access(savedPath, constants.R_OK | constants.W_OK);
    } catch (accessError) {
      console.warn(`[Main] No read/write permission for: ${savedPath}`);
      console.warn('[Main] Permission error:', accessError);

      // Notify renderer about permission issue
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('workspace:permission-denied', {
          path: savedPath,
          message: '工作目录权限不足，已切换到默认目录'
        });
      }

      return defaultWorkspace;
    }

    // 7. All validations passed, return valid path
    console.log(`[Main] ✓ Restored workspace from config: ${savedPath}`);
    return savedPath;

  } catch (err) {
    console.error('[Main] Failed to load workspace config:', err);
    console.error('[Main] Stack trace:', (err as Error).stack);
    return defaultWorkspace;
  }
}

function createWindow(): void {
  Menu.setApplicationMenu(buildApplicationMenu());

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: '灵境',
    backgroundColor: '#1e1e1e',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed for preload to access node APIs
      webSecurity: true,
    },
  });

  console.log('[Main] Preload path:', join(__dirname, 'preload.js'));
  console.log('[Main] __dirname:', __dirname);
  console.log('[Main] app.isPackaged:', app.isPackaged);
  console.log('[Main] process.resourcesPath:', process.resourcesPath);
  console.log('[Main] process.cwd():', process.cwd());
  
  // Check if preload file exists
  const preloadPath = join(__dirname, 'preload.js');
  console.log('[Main] Preload exists:', existsSync(preloadPath));

  // ── Renderer failure protection layer 1: showTimeout ──
  // ready-to-show may never fire if renderer crashes/hangs during load.
  // Force-show window after 10s and attempt a reload to recover.
  const showTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.warn('[Main] ready-to-show timeout (10s) — forcing window show + reload');
      mainWindow.show();
      mainWindow.webContents.reload();
    }
  }, 10000);

  // Show window when ready to avoid visual flash
  mainWindow.once('ready-to-show', () => {
    clearTimeout(showTimeout);
    mainWindow?.show();
  });

  // ── Renderer failure protection layer 2: did-fail-load ──
  // If the renderer process fails to load the page (e.g., missing files),
  // automatically retry. Cap retries at 3 to prevent infinite loops.
  let failLoadRetries = 0;
  const MAX_FAIL_RETRIES = 3;
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Main] Renderer did-fail-load: code=${errorCode}, desc=${errorDescription}, url=${validatedURL}`);
    if (failLoadRetries < MAX_FAIL_RETRIES) {
      failLoadRetries++;
      console.warn(`[Main] Retrying load (attempt ${failLoadRetries}/${MAX_FAIL_RETRIES})...`);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reload();
        }
      }, 1000);
    } else {
      console.error('[Main] Max fail-load retries exceeded — showing window with error state');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
      }
    }
  });

  // ── Renderer failure protection layer 3: unresponsive (GUI hang) ──
  mainWindow.on('unresponsive', () => {
    console.error('[Main] Renderer process became unresponsive');
    // Don't force-reload here — let the user decide. Just log.
    // The showTimeout above will handle the startup-case hang.
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Register Fusion IPC handlers BEFORE renderer loads (FIX: race condition)
  // This ensures fusion:health:check and all fusion handlers are registered
  // before the renderer FusionSettings component mounts and tries to call them.
  registerFusionIPC(mainWindow);

  // Load renderer
  if (IS_DEV) {
    // In dev mode, load from Vite dev server
    const rendererPort = process.env.RENDERER_PORT || '5173';
    mainWindow.loadURL(`http://localhost:${rendererPort}`);
    mainWindow.webContents.openDevTools({ mode: 'bottom' });
  } else {
    // In production, load built renderer files
    // Packaged: app.asar/renderer/index.html (in-asar)
    // Dev monorepo: dist/main.js -> ../../renderer/dist/index.html
    const rendererPath = app.isPackaged
      ? join(__dirname, '../renderer/index.html')
      : join(__dirname, '../../renderer/dist/index.html');
    console.log('[Main] Renderer path:', rendererPath);
    console.log('[Main] Renderer exists:', existsSync(rendererPath));
    mainWindow.loadFile(rendererPath);
    
    // DevTools is disabled in production for security and performance
    // To enable temporarily: uncomment the line below and rebuild
    // mainWindow.webContents.openDevTools({ mode: 'bottom' });
  }

  mainWindow.on('closed', () => {
    clearTimeout(showTimeout);
    mainWindow = null;
  });
}

function registerAppIpc(): void {
  // Config IPC
  ipcMain.handle('config:get', async () => {
    const { loadConfig, getModelContextWindow } = await import('@codepilot/core');
    const loaded = await loadConfig();
    // Override maxContextTokens with model-specific context window
    const cfg = { ...loaded.config };
    cfg.maxContextTokens = getModelContextWindow(cfg.model, cfg.maxContextTokens);
    return cfg;
  });

  ipcMain.handle('config:set', async (_event, { key, value }: { key: string; value: unknown }) => {
    const configPath = join(homedir(), '.lingjing', 'config.json');
    const configDir = dirname(configPath);
    if (!existsSync(configDir)) {
      await mkdir(configDir, { recursive: true });
    }
    let existing: Record<string, unknown> = {};
    try {
      const raw = await readFile(configPath, 'utf8');
      existing = JSON.parse(raw);
    } catch {
      // file doesn't exist yet
    }

    // Support nested keys like "apiKeys.openai"
    const parts = key.split('.');
    if (parts.length === 1) {
      existing[key] = value;
    } else {
      let obj: any = existing;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
          obj[parts[i]] = {};
        }
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
    }

    await writeFile(configPath, JSON.stringify(existing, null, 2));

    // If model or apiKeys changed, reinitialize the LLM provider
    if (key === 'model' || key.startsWith('apiKeys.') || key.startsWith('ollama.')) {
      try {
        await reinitProvider();
        resetCompletionProvider();
        resetInlineChatProvider();
        resetCompactProvider();
        resetPolishProvider();
        reinitQuestProvider();
      } catch (err) {
        console.error('Failed to reinit provider after config change:', err);
      }
    }
  });

  ipcMain.handle('config:get-workspace', async () => {
    return workspacePath;
  });

  ipcMain.handle('config:set-workspace', async (_event, { path }: { path: string }) => {
    console.log('[Config] Setting workspace to:', path);

    try {
      // 1. Parameter validation
      if (!path || typeof path !== 'string') {
        throw new Error('Invalid path parameter: path must be a non-empty string');
      }

      // 2. Path existence validation
      if (!existsSync(path)) {
        throw new Error(`Path does not exist: ${path}`);
      }

      // 3. Directory type validation
      const fsPromises = await import('node:fs/promises');
      const stats = await fsPromises.stat(path);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${path}`);
      }

      // 4. Permission validation
      try {
        const constants = (await import('node:fs')).constants;
        await fsPromises.access(path, constants.R_OK | constants.W_OK);
      } catch {
        throw new Error(`Insufficient permissions for path: ${path}`);
      }

      // 5. Set working directory
      const oldPath = workspacePath;
      workspacePath = path;
      setWorkingDirectory(path);

      // 6. Persist to config file
      const configPath = join(homedir(), '.lingjing', 'config.json');
      const configDir = dirname(configPath);

      // Ensure config directory exists
      if (!existsSync(configDir)) {
        await mkdir(configDir, { recursive: true });
      }

      // Read existing config or create new one
      let existing: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        try {
          const raw = await readFile(configPath, 'utf8');
          existing = JSON.parse(raw);
        } catch {
          console.warn('[Config] Failed to read existing config, creating new one');
        }
      }

      // Update lastWorkspace field
      existing.lastWorkspace = path;
      existing.lastWorkspaceUpdateAt = new Date().toISOString();

      await writeFile(configPath, JSON.stringify(existing, null, 2));
      console.log('[Config] ✓ Workspace saved to config:', path);

      // 7. Notify renderer process
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('workspace:changed', {
          oldPath,
          newPath: path,
          timestamp: Date.now()
        });
      }

      return { success: true, path };

    } catch (err: any) {
      console.error('[Config] Failed to set workspace:', err);

      // Notify renderer process about error
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('workspace:error', {
          error: err.message,
          path,
          timestamp: Date.now()
        });
      }

      throw err; // Re-throw so renderer can catch it
    }
  });

  // App info IPC
  ipcMain.handle('app:get-version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:platform', async () => {
    return process.platform;
  });

  // Tools list IPC - returns all built-in tool names and descriptions
  ipcMain.handle('tools:list', async () => {
    const { createDefaultRegistry } = await import('@codepilot/core');
    const registry = createDefaultRegistry();
    return registry.getAll().map((t: any) => ({ name: t.name, description: t.description }));
  });

  // Config reset IPC - resets config to defaults
  ipcMain.handle('config:reset', async () => {
    const configPath = join(homedir(), '.lingjing', 'config.json');
    await writeFile(configPath, '{}');
    try {
      await reinitProvider();
    } catch (err) {
      console.error('Failed to reinit provider after config reset:', err);
    }
  });

  // Window management IPC
  ipcMain.handle('window:new', async () => {
    const child = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      title: '灵境',
      backgroundColor: '#1e1e1e',
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
      },
    });
    Menu.setApplicationMenu(buildApplicationMenu());
    if (IS_DEV) {
      const rendererPort = process.env.RENDERER_PORT || '5173';
      child.loadURL(`http://localhost:${rendererPort}`);
    } else {
      const rendererPath = app.isPackaged
        ? join(__dirname, '../renderer/index.html')
        : join(__dirname, '../../renderer/dist/index.html');
      child.loadFile(rendererPath);
    }
  });

  ipcMain.handle('window:close', async () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:zoom-in', async () => {
    if (mainWindow) {
      const current = mainWindow.webContents.getZoomLevel();
      mainWindow.webContents.setZoomLevel(current + 0.5);
    }
  });

  ipcMain.handle('window:zoom-out', async () => {
    if (mainWindow) {
      const current = mainWindow.webContents.getZoomLevel();
      mainWindow.webContents.setZoomLevel(current - 0.5);
    }
  });

    ipcMain.handle('window:open-devtools', async () => {
    mainWindow?.webContents.openDevTools({ mode: 'bottom' });
  });

  ipcMain.handle('window:zoom-reset', async () => {
    mainWindow?.webContents.setZoomLevel(0);
  });
}

/**
 * Register global shortcuts for opening settings
 * macOS: Cmd + Shift + ,
 * Windows/Linux: Ctrl + Shift + ,
 */
function registerShortcuts(mainWindow: BrowserWindow): void {
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+,' : 'Control+Shift+,';
  
  globalShortcut.register(shortcut, () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-settings');
    }
  });

  // Register F12 / Ctrl+Shift+I for DevTools (production-safe)
  globalShortcut.register('F12', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools({ mode: 'bottom' });
    }
  });
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools({ mode: 'bottom' });
    }
  });
}

async function bootstrap(): Promise<void> {
  // Grant microphone/media permission (must be after app.whenReady)
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, _callback) => {
    const permitted = permission === 'media' || permission === 'mediaKeySystem';
    _callback(permitted);
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media' || permission === 'mediaKeySystem';
  });

  // Allow iframes to load localhost URLs for Quest Preview
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' blob: 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://ide.zhejiangjinmo.com http://localhost:* ws://localhost:* wss://ide.zhejiangjinmo.com; worker-src 'self' blob:; frame-src 'self' http://localhost:*;",
      ],
    };
    callback({ responseHeaders });
  });

  // Initialize database (required for auth)
  let dbInitStatus = 'pending';
  let dbInitError: Error | null = null;
  
  console.error('[Main] Starting database initialization...');
  try {
    await initDatabase();
    dbInitStatus = 'success';
    console.error('[Main] Database initialized successfully');
  } catch (err) {
    dbInitStatus = 'failed';
    dbInitError = err as Error;
    console.error('[Main] Failed to initialize database:', err);
    console.error('[Main] Auth features will not work without database');
  }

  // Load workspace BEFORE creating window — ensures renderer sees restored workspace immediately
  try {
    workspacePath = await loadWorkspaceFromConfig();
    setWorkingDirectory(workspacePath);
    console.log('[Main] Workspace loaded before window creation:', workspacePath);
  } catch (wsErr) {
    console.error('[Main] Failed to load workspace before window:', wsErr);
    workspacePath = homedir();
    setWorkingDirectory(workspacePath);
  }

  // Create window — show UI immediately even if agent init is slow
  createWindow();

  // Send startup logs and database status to renderer after window is created
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.on('did-finish-load', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Send bootstrap status
        mainWindow.webContents.send('app:log', {
          message: '[Main] Application started, bootstrap in progress...',
        });
        
        // Send database initialization status
        mainWindow.webContents.send('app:db-status', {
          status: dbInitStatus,
          error: dbInitError?.message,
          stack: dbInitError?.stack,
        });
      }
    });
  }

  // ── Phase A: Register IPC handlers that DON'T need mainWindow ──
  // These critical handlers (config:set, update:check, web-server) MUST be registered
  // even if window creation fails. The renderer may start making IPC calls immediately
  // after loading, and window-independent handlers must be ready.
  //
  // CRITICAL: This MUST come BEFORE await loadWorkspaceFromConfig() below.
  // If the renderer loads during the async file I/O and makes IPC calls
  // to unregistered handlers (config:set, update:check, etc.), the calls
  // fail with "No handler registered" errors.

  // Config IPC (config:get, config:set) — no window dependency
  try {
    registerAppIpc();
  } catch (err) {
    console.error('[Main] registerAppIpc failed:', err);
  }

  // Initialize web server function references (avoid circular dependency)
  try {
    initWebServerFunctions(
      () => mainWindow,
      () => { return getDatabase(); },
      async () => { await saveDatabase(); }
    );
  } catch (err) {
    console.error('[Main] initWebServerFunctions failed:', err);
  }

  // Auto-update IPC (update:check) — handles mainWindow null internally
  try {
// @ts-expect-error - TS2345: BrowserWindow | null not assignable to BrowserWindow
    initUpdateIPC(mainWindow);
  } catch (err) {
    console.error('[Main] Failed to initialize update IPC:', err);
    try {
      ipcMain.handle('update:check', async () => {
        console.log('[update] Using emergency fallback handler');
        try {
          const res = await fetch('https://ide.zhejiangjinmo.com/api/latest', { signal: AbortSignal.timeout(5000) });
          if (res.ok) {
            const data = await res.json();
            const current = app.getVersion();
            return { ok: true, version: data.version, currentVersion: current };
          }
        } catch { /* network error - browser fetch failed */ }
        return { notActive: true, currentVersion: app.getVersion() };
      });
      console.log('[Main] Registered emergency update:check fallback handler');
    } catch { /* emergency fallback registration failed - best effort */ }
  }

  // Other window-independent handlers
  try { registerMcpIpc(); } catch (err) { console.error('[Main] registerMcpIpc failed:', err); }
  autoConnectMcpServers().catch(err => { console.error('[Main] autoConnectMcpServers failed:', err); });
  try { registerAuthIpc(); } catch (err) { console.error('[Main] registerAuthIpc failed:', err); }
  try { registerOllamaIpc(); } catch (err) { console.error('[Main] registerOllamaIpc failed:', err); }
  try { registerMemoryIpc(); } catch (err) { console.error('[Main] registerMemoryIpc failed:', err); }
  try { registerIntegrationsIpc(); } catch (err) { console.error('[Main] registerIntegrationsIpc failed:', err); }
  try { registerNetworkIpc(); } catch (err) { console.error('[Main] registerNetworkIpc failed:', err); }
  try { registerCompletionIpc(); } catch (err) { console.error('[Main] registerCompletionIpc failed:', err); }
  try { registerInlineChatIpc(); } catch (err) { console.error('[Main] registerInlineChatIpc failed:', err); }
  try { registerCompactIpc(); } catch (err) { console.error('[Main] registerCompactIpc failed:', err); }
  try { registerPromptIpc(); } catch (err) { console.error('[Main] registerPromptIpc failed:', err); }
  try { registerQuestStateIpc(); console.log('[Main] registerQuestStateIpc completed successfully');
  } catch (err) { console.error('[Main] registerQuestStateIpc failed:', err); }

  // SSH IPC — register window-independent handlers (ssh:list-connections) in Phase A
  // ssh:list-connections only reads the database, doesn't need mainWindow.
  // This prevents "No handler registered" errors when renderer queries SSH connections
  // before Phase B completes (race condition during startup).
  // Window-dependent SSH handlers (terminal-data forwarding) remain in Phase B.
  try {
    const { registerSshIpcWindowIndependent } = await import('./ssh/ssh-ipc.js');
    registerSshIpcWindowIndependent();
    console.log('[Main] SSH window-independent IPC registered successfully');
  } catch (err) {
    console.error('[Main] registerSshIpcWindowIndependent failed:', err);
  }

  // Cloud management (user, device, subscription, sync, storage, apiKey)
  try {
    registerAllCloudManagementIpc();
    registerCheckpointIPC(app.getPath('userData'));
    console.log('[Main] Cloud management IPC registered successfully');
  } catch (err) {
    console.error('[Main] registerAllCloudManagementIpc failed:', err);
  }

  // Workflow engine IPC
  try {
    registerWorkflowIPCWithDb(ipcMain, getDatabase());
    console.log('[Main] registerWorkflowIPCWithDb completed successfully');
  } catch (err) {
    console.error('[Main] registerWorkflowIPCWithDb failed:', err);
  }

  // Admin dashboard (auth, version, mcp, quest, config, log)
  try {
    registerAdminIpc();
    console.log('[Main] registerAdminIpc completed successfully');
  } catch (err) {
    console.error('[Main] registerAdminIpc failed:', err);
  }

  // Voice IPC (speech recognition)
  try {
    const voiceEngine = new VoiceEngineManager();
    registerVoiceIPC(voiceEngine);
    console.log('[Main] Voice IPC registered');
  } catch (err) {
    console.warn('[Main] Voice IPC registration:', err);
  }

  // New Feature IPC (register-new-features.ts)
  try {
    registerNewFeatureIPC({
      checkpointDir: app.getPath('userData'),
      projectRoot: workspacePath,
      contextMaxTokens: 8000,
    });
    console.log('[Main] New feature IPC registered');
  } catch (err) {
    console.warn('[Main] New feature IPC registration:', err);
  }

  // Register fallback handlers for new-feature IPC channels lacking backend impl
  try {
    ipcMain.handle('intent:getState', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('terminalSuggest:analyze', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('autoFix:suggest', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('autoFix:apply', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('autoFix:batchSuggest', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('rule:reload', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('rule:getMerged', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('rule:getConflicts', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('agentMode:previewPlan', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('agentMode:executePlan', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('agentMode:confirmStep', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('agentMode:interrupt', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('multiFileEdit:generate', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('multiFileEdit:acceptFile', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('multiFileEdit:rejectFile', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('multiFileEdit:acceptBlock', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('multiFileEdit:rejectBlock', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('multiFileEdit:applyAll', async () => ({ success: false, error: 'Not implemented' }));
    console.log('[Main] Registered fallback IPC handlers');
  } catch (err) {
    console.warn('[Main] Fallback handler registration:', err);
  }

  // Subscription fallback IPC handlers (preload exposes subscription:xxx but no backend impl)
  try {
    ipcMain.handle('subscription:status', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('subscription:plans', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('subscription:create', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('subscription:cancel', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('subscription:payments', async () => ({ success: false, error: 'Not implemented' }));
    ipcMain.handle('subscription:offline-payment', async () => ({ success: false, error: 'Not implemented' }));
    console.log('[Main] Registered subscription fallback IPC handlers');
  } catch (err) {
    console.warn('[Main] Subscription fallback registration:', err);
  }

  // Initialize cloud sync and GitHub integration
  try {
    const deviceId = generateDeviceFingerprint().fingerprint;
    initCloudSyncIpc(deviceId);
    initGitHubIpc();
    console.log('[Main] Cloud sync and GitHub integration initialized with device ID:', deviceId);
  } catch (err) {
    console.error('[Main] Cloud sync/GitHub init failed:', err);
  }

  // Auto-register IDE device on startup (fire-and-forget)
  try {
    const deviceFingerprint = generateDeviceFingerprint();
    const deviceId = deviceFingerprint.fingerprint;
    const platform = process.platform;
    const osRelease = require('node:os').release();
    const appVersion = app.getVersion();

    // Device auto-registration via /api/auth/register (API key from environment)
    const deviceApiKey = process.env.LINGJING_CLOUD_API_KEY || process.env.API_KEY || '';
    fetch('https://ide.zhejiangjinmo.com/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId, deviceName: 'IDE-' + platform + '-' + deviceId.slice(0, 8),
        deviceInfo: { type: 'desktop', os: platform + ' ' + osRelease, version: appVersion },
        apiKey: deviceApiKey
      })
    }).then(res => {
      if (res.ok) console.log('[Main] Device auto-registered:', deviceId.slice(0, 12) + '...');
      else console.warn('[Main] Device auto-registration failed:', res.status);
    }).catch(err => { console.warn('[Main] Device auto-registration error:', err.message); });

    // Heartbeat is handled by CloudSyncClient (30s interval via WebSocket ping)
    // No separate heartbeat fetch needed
    console.log('[Main] Device heartbeat scheduler started');
  } catch (err) {
    console.warn('[Main] Device auto-registration setup failed:', err);
  }

  // ── Phase B: Register handlers that NEED mainWindow ──
  // These handlers require a valid BrowserWindow instance and will be
  // skipped if the window failed to create.
  if (mainWindow) {
    registerAgentIpc(mainWindow);
    registerFsIpc(mainWindow, () => workspacePath);
    registerTerminalIpc(mainWindow);
    registerGitIpc(() => workspacePath);
    registerSkillsIpc(() => workspacePath);
    registerSkillMarketIpc();
    registerIndexingIpc(() => workspacePath, mainWindow);
    registerDiagnosticsIpc(mainWindow, () => workspacePath);
    console.log('[Main] About to call registerQuestIpc...');
    try {
      registerQuestIpc(mainWindow, () => workspacePath);
      console.log('[Main] registerQuestIpc completed successfully');
    } catch (err) {
      console.error('[Main] registerQuestIpc failed:', err);
    }
    registerWikiIpc(mainWindow, () => workspacePath);
    registerBrowserIpc(mainWindow);
    registerPlanIpc(mainWindow);
    registerContextIpc(() => workspacePath);
    setSshTerminalChangeCallback((sshTerminalId) => {
      setSshTerminalId(sshTerminalId);
      setQuestSshTerminalId(sshTerminalId);
    });
    registerSshIpc(mainWindow);

    // Cloud sync
    try {
      registerCloudIpc(mainWindow);
      autoConnectCloud();
    } catch (err) {
      console.error('[Main] Cloud IPC registration failed:', err);
    }

    // Schedule management
    try {
      registerScheduleIpc(mainWindow);
    } catch (err) {
      console.error('[Main] registerScheduleIpc failed:', err);
    }

    // Batch task processing (@codepilot/core at runtime)
    try {
      // @ts-ignore - core types available at runtime
      const { BatchTaskQueue, BatchExecutor } = require('@codepilot/core');
      registerBatchIPC(ipcMain, new BatchTaskQueue(), new BatchExecutor());
      console.log('[Main] Batch IPC registered');
    } catch (err) {
      console.error('[Main] registerBatchIPC failed:', err);
    }

    // Connector management
    try {
      // @ts-ignore - core types available at runtime
      const { ConnectorManager } = require('@codepilot/core');
      registerConnectorIPC(ipcMain, new ConnectorManager());
      console.log('[Main] Connector IPC registered');
    } catch (err) {
      console.error('[Main] registerConnectorIPC failed:', err);
    }

    // Trigger management
    try {
      // @ts-ignore - core types available at runtime
      const { TriggerManager } = require('@codepilot/core');
      registerTriggerIPC(ipcMain, new TriggerManager());
      console.log('[Main] Trigger IPC registered');
    } catch (err) {
      console.error('[Main] registerTriggerIPC failed:', err);
    }

    // Fusion IPC + Full Initialization (DEF-002/003 fix) — comprehensive module init
    try {
      // Initialize all Fusion modules and inject into IPC layer (IPC registered in createWindow)
      try {
        const fusionMod = await import('@codepilot/core/fusion');
        const {
          FusionInitializer, DEFAULT_FUSION_CONFIG,
          EventBus, HookRegistry,
          SlidingWindowMemoryManager, DEFAULT_SLIDING_WINDOW_CONFIG,
          VectorMemoryStore, InMemoryVectorAdapter, DEFAULT_VECTOR_MEMORY_CONFIG,
          SqliteVectorAdapter,
          NudgeReviewEngine, DEFAULT_REVIEW_CONFIG,
          SkillSecurityLoader, DEFAULT_SECURITY_CONFIG,
          ExecutionTraceHarvester, DEFAULT_TRACE_HARVESTER_CONFIG,
          DAGOrchestrator,
          MultiAgentExecutor, DEFAULT_MULTI_AGENT_CONFIG,
          DynamicModelRouter, DEFAULT_MODEL_ROUTER_CONFIG,
          NLCronScheduler, DEFAULT_NL_CRON_CONFIG,
          HonchoUserModeler, DEFAULT_USER_MODELER_CONFIG,
        } = fusionMod;

        if (FusionInitializer) {
          const init = new FusionInitializer();
          const modules = {};

          try { const eb = new EventBus(); init.setEventBus(eb); setEventBus(eb); console.log('[Main] Fusion EventBus created'); } catch (e) { console.warn('[Main] EventBus failed:', e); }
          try { const hr = new HookRegistry(); init.setHookRegistry(hr); setHookRegistry(hr); console.log('[Main] Fusion HookRegistry created'); } catch (e) { console.warn('[Main] HookRegistry failed:', e); }
          try { new SlidingWindowMemoryManager(DEFAULT_SLIDING_WINDOW_CONFIG); console.log('[Main] Fusion SlidingWindow created'); } catch (e) { console.warn('[Main] SlidingWindow failed:', e); }
          try {
            const db = getDatabase();
            const sqliteAdapter = new SqliteVectorAdapter(db, 'vector_memory_store');
            await sqliteAdapter.initialize();
            const vm = new VectorMemoryStore(DEFAULT_VECTOR_MEMORY_CONFIG, sqliteAdapter);
            // Inject real embedding function using createEmbeddingService
            try {
              const { createEmbeddingService } = await import('../services/embedding-service.js');
              const { loadConfig: loadCoreConfig } = await import('@codepilot/core');
              const freshConfig = await loadCoreConfig();
              const embedService = await createEmbeddingService(freshConfig.config);
              const embedDims = embedService.dimensions;
              vm.setEmbedFn(async (text: string) => {
                const vectors = await embedService.embed([text]);
                return Array.from(vectors[0]);
              });
              console.log(`[Main] VectorMemory embedFn injected (type=${embedService.type}, dims=${embedDims})`);
            } catch (embedErr) {
              console.warn('[Main] VectorMemory embedFn injection failed, using hash fallback:', embedErr instanceof Error ? embedErr.message : String(embedErr));
            }
            init.setVectorMemory(vm);
            modules.vectorMemory = vm;
            console.log(`[Main] Fusion VectorMemory created (SqliteAdapter, ${sqliteAdapter.size} existing vectors)`);
          } catch (e) { console.warn('[Main] VectorMemory failed:', e); }
          try { const re = new NudgeReviewEngine(DEFAULT_REVIEW_CONFIG); init.setReviewEngine(re); modules.reviewEngine = re; console.log('[Main] Fusion ReviewEngine created'); } catch (e) { console.warn('[Main] ReviewEngine failed:', e); }
          try { const th = new ExecutionTraceHarvester(DEFAULT_TRACE_HARVESTER_CONFIG); init.setTraceHarvester(th); modules.traceHarvester = th; console.log('[Main] Fusion TraceHarvester created'); } catch (e) { console.warn('[Main] TraceHarvester failed:', e); }
          try { const ss = new SkillSecurityLoader(DEFAULT_SECURITY_CONFIG); modules.skillSecurity = ss; console.log('[Main] Fusion SkillSecurity created'); } catch (e) { console.warn('[Main] SkillSecurity failed:', e); }
          try { const dag = new DAGOrchestrator(async () => ({ success: false, error: 'no-executor' })); init.setDAGOrchestrator(dag); modules.dagOrchestrator = dag; console.log('[Main] Fusion DAGOrchestrator created'); } catch (e) { console.warn('[Main] DAGOrchestrator failed:', e); }
          try { const ma = new MultiAgentExecutor(DEFAULT_MULTI_AGENT_CONFIG, async () => ({ success: false, error: 'no-executor' })); init.setMultiAgent(ma); modules.multiAgent = ma; console.log('[Main] Fusion MultiAgent created'); } catch (e) { console.warn('[Main] MultiAgent failed:', e); }
          try { const mr = new DynamicModelRouter([], DEFAULT_MODEL_ROUTER_CONFIG); init.setModelRouter(mr); modules.modelRouter = mr; console.log('[Main] Fusion ModelRouter created'); } catch (e) { console.warn('[Main] ModelRouter failed:', e); }
          try { const nc = new NLCronScheduler(DEFAULT_NL_CRON_CONFIG); init.setNLCron(nc); modules.nlCron = nc; console.log('[Main] Fusion NLCronScheduler created'); } catch (e) { console.warn('[Main] NLCronScheduler failed:', e); }
          try { const um = new HonchoUserModeler('default', DEFAULT_USER_MODELER_CONFIG); init.setUserModeler(um); modules.userModeler = um; console.log('[Main] Fusion UserModeler created'); } catch (e) { console.warn('[Main] UserModeler failed:', e); }

          // Enable all modules
          const cfg = { ...DEFAULT_FUSION_CONFIG, enabled: true };
          cfg.modules = DEFAULT_FUSION_CONFIG.modules.map((m) => ({ ...m, enabled: true }));
          const initResult = init.initialize(cfg);
          console.log('[Main] Fusion initialized:', initResult.success ? 'success' : 'degraded');
          if (initResult.degraded.length > 0) console.warn('[Main] Fusion degraded:', initResult.degraded.join(', '));

          // Inject all into IPC layer
          modules.fusionInitializer = init;
          setFusionModules(modules);
          console.log('[Main] All Fusion modules injected into IPC layer');

          // Register Agent tools via integration namespace
          try {
            const integ = fusionMod.integration;
            if (integ && integ.registerFusionTools) {
              integ.registerFusionTools();
              console.log('[Main] Fusion tools registered');
            }
          } catch (e) { console.warn('[Main] Fusion tools:', e); }

          // Register Agent skills
          try {
            const integ = fusionMod.integration;
            if (integ && integ.registerFusionSkills) {
              integ.registerFusionSkills(null, null);
              console.log('[Main] Fusion skills registered');
            }
          } catch (e) { console.warn('[Main] Fusion skills:', e); }

          // Setup memory linkages
          try {
            const integ = fusionMod.integration;
            if (integ && integ.setupMemoryLinkages) {
              integ.setupMemoryLinkages({ db: getDatabase() });
              console.log('[Main] Fusion memory linkages established');
            }
          } catch (e) { console.warn('[Main] Fusion memory:', e); }
        }
      } catch (fusionInitErr) {
        console.warn('[Main] Fusion subsystem init skipped (non-critical):', fusionInitErr);
      }
    } catch (err) {
      console.error('[Main] registerFusionIPC failed:', err);
    }
    // Auto-copy frpc binary
    try {
      ensureFrpcBinary();
    } catch (err) {
      console.error('[Main] Failed to ensure frpc binary:', err);
    }

    // Start Web Server for mobile access (if enabled in config)
    try {
      const webServerConfig = loadWebServerConfig();
      if (webServerConfig.enabled) {
        if (!webServerConfig.token) {
          webServerConfig.token = generateToken();
          saveWebServerConfig(webServerConfig);
          console.log('[Main] Generated and saved new token for web server');
        }
        startWebServer(webServerConfig);
        if (webServerConfig.frpEnabled) {
          startFrpClient({
            enabled: webServerConfig.frpEnabled,
            serverAddr: webServerConfig.frpServerAddr,
            serverPort: webServerConfig.frpServerPort,
            remotePort: webServerConfig.frpRemotePort,
            localPort: webServerConfig.port || 3001,
            token: webServerConfig.frpToken || 'lingjing_mobile_token_2024',
            customDomain: webServerConfig.frpCustomDomain || webServerConfig.frpServerAddr,
          });
        }
      }
    } catch (err) {
      console.error('[Main] Failed to start web server:', err);
    }

    // Register global shortcuts
    try {
      registerShortcuts(mainWindow);
    } catch (err) {
      console.error('[Main] Failed to register shortcuts:', err);
    }

    // Verify all critical IPC handlers are registered
    try {
      const missing = verifyIpcRegistrations();
      if (missing.length > 0) {
        console.warn(`[Main] ${missing.length} IPC handlers missing (see ~/.lingjing/startup-error.log)`);
      }
    } catch (err) {
      console.error('[Main] IPC verification failed:', err);
    }
  }

  // Load saved workspace path from config (enhanced validation)
  // NOTE: This runs AFTER IPC registration so the renderer can safely call
  // IPC methods (config:set, update:check, etc.) during the async file I/O below.
  const loadedWorkspace = await loadWorkspaceFromConfig();

  if (loadedWorkspace !== homedir()) {
    // Successfully restored workspace from config
    workspacePath = loadedWorkspace;
    setWorkingDirectory(workspacePath);

    // Notify renderer process that workspace has been restored
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('workspace:restored', {
        path: workspacePath,
        timestamp: Date.now(),
        source: 'config'
      });
    }
  } else {
    // Using default directory
    workspacePath = loadedWorkspace;
    setWorkingDirectory(workspacePath);
    console.log('[Main] Using default workspace:', workspacePath);
  }

  // Initialize the agent core with 15s timeout (load prompts, config, provider)
  // Agent init runs AFTER IPC registration so the renderer can use IPC immediately,
  // but before the user sends their first message.
  try {
    await Promise.race([
      initAgent(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('initAgent timed out after 15s')), 15000)
      ),
    ]);
  } catch (err) {
    console.error('[Main] Failed to initialize agent:', err);
  }
}

// Electron app lifecycle
// ── Crash / exit protection: flush DB before process termination ──
// These handlers prevent database corruption when the process is killed
// forcefully (Ctrl+C, task-kill, uncaught exception, etc.)
app.on('before-quit', async (event) => {
  event.preventDefault();

  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[Main] Notifying renderer to save before quit');
      mainWindow.webContents.send('window:before-close');

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[Main] Renderer save timeout (5s), proceeding to quit');
          resolve();
        }, 5000);

        ipcMain.once('window:close-confirmed', () => {
          clearTimeout(timeout);
          console.log('[Main] Renderer confirmed close, saving database');
          resolve();
        });
      });
    }

    destroyAllTerminals();
    destroyAllSshSessions();
    shutdownLspServers();
    stopAutoCheck();
    saveDatabaseSync();
    console.log('[Main] All cleanup complete, exiting');
  } catch (err) {
    console.error('[Main] Error during before-quit cleanup:', err);
  }

  app.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error);
  if (error?.message?.includes('EADDRINUSE') || error?.message?.includes('spawn')) {
    return;
  }
  try { saveDatabaseSync(); } catch { /* ignore */ }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled rejection:', reason);
});

// Enable Web Speech API for voice input
// Note: commandLine.appendSwitch must be called before app.whenReady()
app.commandLine.appendSwitch('enable-speech-recognition');

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
  
  destroyAllTerminals();
  destroyAllSshSessions();
  shutdownLspServers();
  closeDatabase();
  stopAutoCheck();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    bootstrap();
  }
});

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, _url) => {
    event.preventDefault();
  });
});

// ── Renderer failure protection layer 4: render-process-gone ──
// If the renderer process crashes or is killed, attempt to recover
app.on('render-process-gone', (_event, _webContents, details) => {
  console.error('[Main] Render process gone:', details.reason, 'exitCode:', details.exitCode);
  if (details.reason === 'crashed' || details.reason === 'killed') {
    // If the main window still exists, reload its contents
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.warn('[Main] Renderer crashed/killed — reloading window');
      try {
        mainWindow.webContents.reload();
      } catch (err) {
        console.error('[Main] Failed to reload after render-process-gone:', err);
        // Last resort: recreate the window
        try { mainWindow.close(); } catch {}
        mainWindow = null;
        createWindow();
      }
    }
  }
});

// Web Server configuration management
function loadWebServerConfig(): any {
  const configPath = join(homedir(), '.lingjing', 'web-server.json');
  try {
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('[Main] Failed to load web server config:', err);
  }
  return {
    enabled: false,
    port: 3001,
    token: '',
    frpEnabled: false,
    frpServerAddr: 'wap.zhejiangjinmo.com',
    frpServerPort: 32200,
    frpRemotePort: 8080,
    frpToken: generateToken(),
    frpCustomDomain: 'wap.zhejiangjinmo.com',
  };
}

/**
 * Ensure frpc.exe exists in userData/frp/ directory.
 * Copies from app resources (packaged) or project source (dev) if needed.
 */
function ensureFrpcBinary(): void {
  const frpDir = join(app.getPath('userData'), 'frp');
  const targetPath = join(frpDir, 'frpc.exe');

  // If already exists, nothing to do
  if (existsSync(targetPath)) {
    return;
  }

  // Find source: packaged resources or dev directory
  let sourcePath: string | null = null;

  if (app.isPackaged) {
    const packagedPath = join(process.resourcesPath, 'frp', 'frpc.exe');
    if (existsSync(packagedPath)) {
      sourcePath = packagedPath;
    }
  } else {
    // Dev mode: look relative to source files
    const devPaths = [
      join(__dirname, '..', 'frp', 'frpc.exe'),
      join(__dirname, '..', '..', 'frp', 'frpc.exe'),
      join(__dirname, '..', '..', '..', '..', 'packages', 'electron', 'frp', 'frpc.exe'),
    ];
    for (const p of devPaths) {
      if (existsSync(p)) {
        sourcePath = p;
        break;
      }
    }
  }

  if (!sourcePath) {
    // Fallback: check release/build/frp/ (dev mode assembly output)
    const buildPath = join(__dirname, '..', '..', '..', 'release', 'build', 'frp', 'frpc.exe');
    if (existsSync(buildPath)) {
      sourcePath = buildPath;
      console.log('[Main] Found frpc.exe in release/build/frp/');
    }
  }

  if (!sourcePath) {
    console.warn('[Main] frpc.exe not found in any source path, FRP tunnel may not work');
    return;
  }

  // Create target directory and copy
  try {
    if (!existsSync(frpDir)) {
      mkdirSync(frpDir, { recursive: true });
    }
    writeFileSync(targetPath, readFileSync(sourcePath));
    console.log('[Main] Copied frpc.exe to ' + targetPath);
  } catch (err) {
    console.error('[Main] Failed to copy frpc.exe to ' + targetPath, err);
  }
}

function saveWebServerConfig(config: any): void {
  const configPath = join(homedir(), '.lingjing', 'web-server.json');
  const configDir = join(homedir(), '.lingjing');
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Web Server IPC handlers
ipcMain.handle('web-server:get-config', () => {
  return loadWebServerConfig();
});

ipcMain.handle('web-server:save-config', async (_event, config: any) => {
  saveWebServerConfig(config);
  
  // Restart server — await stop before start to prevent EADDRINUSE
  await stopWebServer();
  stopFrpClient();
  
  if (config.enabled) {
    startWebServer(config);
    if (config.frpEnabled) {
      startFrpClient({
        enabled: config.frpEnabled,
        serverAddr: config.frpServerAddr,
        serverPort: config.frpServerPort,
        remotePort: config.frpRemotePort,
        localPort: config.port || 3001,
        token: config.frpToken || 'lingjing_mobile_token_2024',
        customDomain: config.frpCustomDomain || config.frpServerAddr,
      });
    }
  }
  
  return { success: true };
});

ipcMain.handle('web-server:get-status', () => {
  const frpStatus = getFrpStatus();
  return {
    webServerRunning: isWebServerRunning(),
    frp: frpStatus,
  };
});

ipcMain.handle('web-server:diagnose', () => {
  const cfg = loadWebServerConfig();
  const diag = getDiagnostics();
  return {
    config: cfg,
    diagnostics: diag,
    webServerRunning: isWebServerRunning(),
  };
});

// Handle quest creation from mobile
ipcMain.on('quest:create-from-mobile', (_event, data: any) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('quest:create-from-mobile', data);
  }
});

ipcMain.on('quest:cancel-from-mobile', (_event, data: any) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('quest:cancel-from-mobile', data);
  }
});
