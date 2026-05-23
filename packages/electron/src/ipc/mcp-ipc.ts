// MCP IPC handler - manages MCP server connections from Electron renderer
// Supports both built-in (offline) and npx-based MCP servers

import { ipcMain, app } from 'electron';
import { McpManager, type McpServerConfig } from '@codepilot/core/mcp';
import { logger } from '@codepilot/core/utils/logger';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execFile } from 'child_process';
import { MCPInstaller } from '../services/mcp-installer';
import { createLogger } from '../monitoring/logger';

// Lazy init: McpManager is imported at module level but instantiated lazily
// to avoid crashing the entire Electron process if the import fails.
let _mcpManager: InstanceType<typeof McpManager> | null = null;
function getMcpManager(): InstanceType<typeof McpManager> {
  if (!_mcpManager) {
    try {
      _mcpManager = new McpManager();
    } catch (err) {
      console.error('[McpIpc] Failed to create McpManager:', err);
      // Return a minimal stub that throws on any method call
      _mcpManager = new Proxy({} as InstanceType<typeof McpManager>, {
        get(_target, prop) {
          return (..._args: any[]) => {
            console.error(`[McpIpc] McpManager.${String(prop)}() called but McpManager is not available`);
            return Promise.reject(new Error('McpManager not available'));
          };
        }
      });
    }
  }
  return _mcpManager;
}
const mcpLogger = createLogger('mcp-ipc');
const mcpInstaller = new MCPInstaller();

let mainWindow: Electron.BrowserWindow | null = null;

const MCP_CONFIG_PATH = join(homedir(), '.lingjing', 'mcp-servers.json');

// Export mcpManager as a getter-based reference for external consumers
// This is a const reference to the getMcpManager() result — it's safe because
// once instantiated, the _mcpManager singleton doesn't change.
const mcpManager = getMcpManager();
export { mcpManager };

// ── Built-in MCP package resolution ──────────────────────────────────────────
// Bundled MCP packages are installed at build time into mcp-packages/ and
// shipped as electron-builder extraResources. At runtime they are available at:
//   - Production:  process.resourcesPath + '/mcp-packages'
//   - Development: <project-root>/release/build/mcp-packages/

// Map marketplace entry IDs to their npm package names
const BUILTIN_PACKAGE_MAP: Record<string, string> = {
  'github': '@modelcontextprotocol/server-github',
  // fetch: @modelcontextprotocol/server-fetch was removed from npm (404)
  // When a replacement becomes available, add it back.
  'filesystem': '@modelcontextprotocol/server-filesystem',
  'weather': '@h1deya/mcp-server-weather',
  'memory': '@modelcontextprotocol/server-memory',
  'brave-search': '@modelcontextprotocol/server-brave-search',
  'sequential-thinking': '@modelcontextprotocol/server-sequential-thinking',
  // 🆕 v1.11.0: All marketplace MCPs built-in
  'playwright': '@playwright/mcp',
  'context7': '@upstash/context7-mcp',
  'postgres': '@modelcontextprotocol/server-postgres',
  'redis': '@modelcontextprotocol/server-redis',
  'slack': '@modelcontextprotocol/server-slack',
  'gdrive': '@modelcontextprotocol/server-gdrive',
};

function getBuiltinMcpDir(): string {
  try {
    if (app.isPackaged) {
      const resourcesPath = process.resourcesPath;

      // Path 1: extraResources → resources/mcp-packages/
      const extraPath = join(resourcesPath, 'mcp-packages');
      if (existsSync(join(extraPath, 'node_modules'))) {
        return extraPath;
      }

      // Path 2: asarUnpack → resources/app.asar.unpacked/mcp-packages/
      const asarPath = join(resourcesPath, 'app.asar.unpacked', 'mcp-packages');
      if (existsSync(join(asarPath, 'node_modules'))) {
        return asarPath;
      }

      // Fallback to extraPath even if it doesn't exist (runtime will npx-fallback)
      return extraPath;
    }
  } catch {
    // app.isPackaged may throw in some edge cases
  }

  // Development: check multiple possible locations
  const candidates = [
    join(process.cwd(), 'release', 'build', 'mcp-packages'),
    join(process.cwd(), 'resources', 'mcp-packages'),
    join(dirname(process.execPath), 'resources', 'mcp-packages'),
  ];

  for (const dir of candidates) {
    if (existsSync(join(dir, 'node_modules'))) {
      return dir;
    }
  }

  // Last resort: try the first candidate even if it doesn't exist
  return candidates[0];
}

function resolveBuiltinCommand(packageName: string): { command: string; args: string[] } | null {
  const mcpDir = getBuiltinMcpDir();
  const pkgDir = join(mcpDir, 'node_modules', packageName);

  // Check standard npm package layout
  const pkgJsonPath = join(pkgDir, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    return null;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

    // Determine entry point with priority: bin → exports → main
    let entryPoint: string | null = null;

    if (pkg.bin) {
      if (typeof pkg.bin === 'string') {
        entryPoint = pkg.bin;
      } else {
        // Object bin: take the first entry
        const bins = Object.values(pkg.bin) as string[];
        if (bins.length > 0) {
          entryPoint = bins[0];
        }
      }
    }

    if (!entryPoint && pkg.exports) {
      // Handle conditional exports
      const exp = pkg.exports;
      if (typeof exp === 'string') {
        entryPoint = exp;
      } else if (exp['.']) {
        const dotExport = exp['.'];
        if (typeof dotExport === 'string') entryPoint = dotExport;
        else if (dotExport.default) entryPoint = dotExport.default;
        else if (dotExport.import) entryPoint = dotExport.import;
        else if (dotExport.require) entryPoint = dotExport.require;
      }
    }

    if (!entryPoint && pkg.main) {
      entryPoint = pkg.main;
    }

    if (!entryPoint) {
      entryPoint = 'index.js';
    }

    const fullPath = join(pkgDir, entryPoint);
    if (existsSync(fullPath)) {
      return { command: 'node', args: [fullPath] };
    }

    // Try dist/ subdirectory as MCP servers often put artifacts there
    const distPath = join(pkgDir, 'dist', entryPoint.replace(/^dist[/\\]/, ''));
    if (existsSync(distPath)) {
      return { command: 'node', args: [distPath] };
    }

    // Try with .js extension appended
    const jsPath = fullPath.endsWith('.js') ? fullPath : fullPath + '.js';
    if (existsSync(jsPath)) {
      return { command: 'node', args: [jsPath] };
    }

    return null;
  } catch {
    return null;
  }
}

function isBuiltinMcpAvailable(marketplaceId: string): boolean {
  const packageName = BUILTIN_PACKAGE_MAP[marketplaceId];
  if (!packageName) return false;

  const result = resolveBuiltinCommand(packageName);
  return result !== null;
}

/**
 * Check if Playwright Chromium browser is installed locally.
 * Checks the Playwright browsers cache directory for Chromium installations.
 * Uses async execFile to check version instead of blocking main process.
 */
export async function isPlaywrightChromiumInstalled(): Promise<boolean> {
  try {
    // Method 1: Check Playwright browsers cache directory
    const { join } = await import('path');
    const { homedir } = await import('os');
    const { existsSync, readdirSync } = await import('fs');
    const possibleCacheDirs = [
      join(homedir(), 'AppData', 'Local', 'ms-playwright'),
      join(homedir(), '.cache', 'ms-playwright'),
      '/home/' + (process.env.USER || 'root') + '/.cache/ms-playwright',
      '/root/.cache/ms-playwright',
    ];
    for (const dir of possibleCacheDirs) {
      if (existsSync(dir)) {
        const entries = readdirSync(dir);
        if (entries.some(e => e.toLowerCase().startsWith('chromium'))) {
          return true;
        }
      }
    }

    // Method 2: Try `npx playwright --version` to check if Playwright CLI is available
    const { execFile } = await import('child_process');
    const versionOut = await new Promise<string>((resolve, reject) => {
      execFile('npx', ['playwright', '--version'], {
        timeout: 10000,
        windowsHide: true,
      }, (err, stdout) => {
        if (err) { reject(err); return; }
        resolve(stdout || '');
      });
    });
    if (versionOut) {
      console.log('[MCP] Playwright CLI available:', versionOut.trim());
      // CLI is available, check if chromium is installed via browsers list
      const listOut = await new Promise<string>((resolve, reject) => {
        execFile('npx', ['playwright', 'install', '--list'], {
          timeout: 10000,
          windowsHide: true,
        }, (err, stdout) => {
          resolve(stdout || ''); // Don't reject — --list may fail on older versions
        });
      });
      if (listOut && (listOut.includes('chromium') || listOut.includes('installed'))) {
        return true;
      }
    }
  } catch (e) {
    console.warn('[MCP] isPlaywrightChromiumInstalled check failed:', e);
  }
  return false;
}

/**
 * Auto-install Playwright Chromium browser via npx.
 * Shows progress via IPC events sent to the main window.
 * Throws on failure with a descriptive error message.
 */
async function installPlaywrightChromium(): Promise<void> {
  const sendProgress = (stage: string, message: string, progress?: number) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp:chromium-install-progress', { stage, message, progress });
    }
    mcpLogger.info(`[ChromiumInstall] ${message}`);
  };

  sendProgress('installing', '正在下载 Chromium 浏览器(约300MB)，请耐心等待...', 0);

  const CHROMIUM_INSTALL_TIMEOUT = 300_000; // 5 minutes
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      'npx',
      ['playwright', 'install', 'chromium'],
      {
        timeout: CHROMIUM_INSTALL_TIMEOUT,
        maxBuffer: 1024 * 1024, // 1MB stdout buffer
        windowsHide: true,
        env: (() => { const e = { ...process.env }; delete e.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD; return e; })(), // ensure download is NOT skipped
      },
      (err, stdout, stderr) => {
        if (err) {
          // Collect useful diagnostics from stderr
          const detail = stderr ? stderr.trim().slice(0, 500) : '';
          const msg = `Chromium安装失败: ${err.message}${detail ? ' — ' + detail : ''}`;
          mcpLogger.error(`[ChromiumInstall] Failed: ${msg}`);
          reject(new Error(msg));
          return;
        }
        sendProgress('completed', 'Chromium 浏览器安装完成', 100);
        resolve();
      }
    );

    // Track download progress from stderr (npx/playwright outputs percentage to stderr)
    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        // Try to extract percentage from stderr output like " 45%"
        const match = text.match(/(\d+)%/);
        if (match) {
          const pct = parseInt(match[1], 10);
          sendProgress('downloading', `正在下载 Chromium (${pct}%)...`, pct);
        } else if (text.includes('chromium')) {
          sendProgress('downloading', `正在下载 Chromium 浏览器...`);
        }
      });
    }
    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        if (text.includes('chromium') || text.includes('Chromium')) {
          sendProgress('installing', text.trim().slice(0, 100));
        }
      });
    }
  });
}

export function setMcpMainWindow(win: Electron.BrowserWindow | null): void {
  mainWindow = win;
}

function loadMcpConfig(): Record<string, McpServerConfig> {
  try {
    if (!existsSync(MCP_CONFIG_PATH)) {
      return {};
    }
    const raw = readFileSync(MCP_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveMcpConfig(config: Record<string, McpServerConfig>): void {
  const dir = dirname(MCP_CONFIG_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export async function autoConnectMcpServers(): Promise<void> {
  // Overall timeout: don't let auto-connect run longer than 60s total
  const AUTO_CONNECT_TIMEOUT = 60_000; // 60 seconds
  const PER_SERVER_TIMEOUT = 15_000;   // 15 seconds per server
  const timer = setTimeout(() => {
    logger.warn(`[MCP] Auto-connect timed out after ${AUTO_CONNECT_TIMEOUT / 1000}s`);
  }, AUTO_CONNECT_TIMEOUT);

  try {
    const savedConfig = loadMcpConfig();
    const serverNames = Object.keys(savedConfig);

    // ── Phase 1: Connect previously saved user configurations ──
    if (serverNames.length > 0) {
      logger.info(`[MCP] Auto-connecting ${serverNames.length} saved server(s)...`);
      for (const [name, config] of Object.entries(savedConfig)) {
        try {
          const result = await Promise.race([
            mcpManager.addServer(name, config),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`连接超时(${PER_SERVER_TIMEOUT / 1000}s)`)), PER_SERVER_TIMEOUT)
            ),
          ]);
          if (result.success) {
            logger.info(`[MCP:${name}] Auto-connected (saved config)`);
          } else {
            logger.error(`[MCP:${name}] Auto-connect failed: ${result.error}`);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(`[MCP:${name}] Auto-connect failed: ${message}`);
        }
      }
    }

    // ── Phase 2: Auto-connect built-in servers that need zero configuration ──
    const entries = getMarketplaceEntries();
    let autoConnectedCount = 0;

    for (const entry of entries) {
      if (savedConfig[entry.name]) continue;
      if (entry.requiredEnv.length > 0) continue;
      if (entry.id === 'playwright') continue;
      if (!BUILTIN_PACKAGE_MAP[entry.id]) continue;

      const builtinCommand = resolveBuiltinCommand(BUILTIN_PACKAGE_MAP[entry.id]);
      if (!builtinCommand) {
        logger.warn(`[MCP:${entry.name}] Built-in package not found on disk, skipping auto-connect`);
        continue;
      }

      const config: McpServerConfig = {
        command: builtinCommand.command,
        args: builtinCommand.args,
        env: {},
      };

      try {
        const result = await Promise.race([
          mcpManager.addServer(entry.name, config),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error(`连接超时(${PER_SERVER_TIMEOUT / 1000}s)`)), PER_SERVER_TIMEOUT)
          ),
        ]);
        if (result.success) {
          logger.info(`[MCP:${entry.name}] Auto-connected (built-in, no config needed)`);
          savedConfig[entry.name] = config;
          autoConnectedCount++;
        } else {
          logger.warn(`[MCP:${entry.name}] Auto-connect skipped: ${result.error}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`[MCP:${entry.name}] Auto-connect skipped: ${message}`);
      }
    }

    if (autoConnectedCount > 0) {
      saveMcpConfig(savedConfig);
      logger.info(`[MCP] Auto-connected ${autoConnectedCount} built-in server(s) with zero config`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export function registerMcpIpc(): void {
  ipcMain.handle('mcp:connect', async (_event, { name, config }: { name: string; config: McpServerConfig }) => {
    logger.info(`[MCP] Connecting to "${name}"...`, JSON.stringify(config, null, 2));

    const result = await mcpManager.addServer(name, config);

    if (result.success && result.client) {
      const savedConfig = loadMcpConfig();
      savedConfig[name] = config;
      saveMcpConfig(savedConfig);

      logger.info(`[MCP:${name}] Connected successfully with ${result.client.tools.length} tools`);
      return {
        success: true,
        serverInfo: result.client.serverInfo,
        tools: result.client.tools.map((t) => ({ name: t.name, description: t.description })),
      };
    }

    logger.error(`[MCP] Failed to connect "${name}": ${result.error}`);
    return {
      success: false,
      error: result.error,
      errorCategory: result.errorCategory,
    };
  });

  ipcMain.handle('mcp:disconnect', async (_event, { name }: { name: string }) => {
    await mcpManager.removeServer(name);

    const savedConfig = loadMcpConfig();
    delete savedConfig[name];
    saveMcpConfig(savedConfig);

    return { success: true };
  });

  ipcMain.handle('mcp:list-servers', async () => {
    const servers = mcpManager.getConnectedServers();
    const result = servers.map((name) => {
      const client = mcpManager.getClient(name);
      return {
        name,
        serverInfo: client?.serverInfo,
        tools: client?.tools.map((t) => ({ name: t.name, description: t.description })) || [],
      };
    });
    return result;
  });

  ipcMain.handle('mcp:list-saved', async () => {
    const savedConfig = loadMcpConfig();
    const connectedServers = new Set(mcpManager.getConnectedServers());
    const serverStates = mcpManager.getServerStates();
    const stateMap = new Map(serverStates.map(s => [s.name, s]));

    return Object.entries(savedConfig).map(([name, config]) => {
      const state = stateMap.get(name);
      return {
        name,
        config,
        connected: connectedServers.has(name),
        state: state?.state || 'disconnected',
        error: state?.error,
        errorCategory: state?.errorCategory,
      };
    });
  });

  ipcMain.handle('mcp:call-tool', async (_event, { serverName, toolName, args }: {
    serverName: string;
    toolName: string;
    args: Record<string, unknown>;
  }) => {
    const client = mcpManager.getClient(serverName);
    if (!client?.connected) {
      return {
        success: false,
        error: `服务器 ${serverName} 未连接`,
        errorCategory: 'network' as const,
      };
    }

    try {
      const result = await client.callTool(toolName, args);
      return { success: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, errorCategory: 'unknown' as const };
    }
  });

  ipcMain.handle('mcp:list-states', async () => {
    return mcpManager.getServerStates();
  });

  ipcMain.handle('mcp:marketplace:list', async () => {
    const connectedNames = new Set(mcpManager.getConnectedServers());
    return getMarketplaceEntries().map(entry => ({
      ...entry,
      builtin: isBuiltinMcpAvailable(entry.id),
      connected: connectedNames.has(entry.name),
      // autoConnectable: true → this server connects automatically on startup
      //                     (no env needed, built-in package present)
      // autoConnectable: false → user must take action (provide env or install)
      autoConnectable: (
        isBuiltinMcpAvailable(entry.id)
        && entry.requiredEnv.length === 0
        && entry.id !== 'playwright'
      ),
    }));
  });

  ipcMain.handle('mcp:marketplace:install', async (_event, { id, env }: { id: string; env?: Record<string, string> }) => {
    const entries = getMarketplaceEntries();
    const entry = entries.find(e => e.id === id);
    if (!entry) {
      return { success: false, error: `未找到MCP服务器: ${id}`, errorCategory: 'validation' as const };
    }

    for (const envKey of entry.requiredEnv) {
      if (!env || !env[envKey]) {
        return {
          success: false,
          error: `请先填写 ${envKey} 环境变量`,
          errorCategory: 'validation' as const,
          missingEnv: entry.requiredEnv,
        };
      }
    }

    // Playwright special: auto-install Chromium if not already installed
    if (entry.id === 'playwright') {
      const chromiumInstalled = await isPlaywrightChromiumInstalled();
      if (!chromiumInstalled) {
        mcpLogger.info('[Playwright] Chromium not found — auto-installing...');
        try {
          await installPlaywrightChromium();
          mcpLogger.info('[Playwright] Chromium installed successfully');
        } catch (installErr) {
          const msg = installErr instanceof Error ? installErr.message : String(installErr);
          mcpLogger.error(`[Playwright] Chromium auto-install failed: ${msg}`);
          return {
            success: false,
            error: msg,
            errorCategory: 'validation' as const,
          };
        }
      }
    }

    // 🔥 Resolve config: use built-in local path if available, fallback to npx
    let config: McpServerConfig;
    const builtinPackage = BUILTIN_PACKAGE_MAP[entry.id];
    const builtinCommand = builtinPackage ? resolveBuiltinCommand(builtinPackage) : null;

    if (builtinCommand) {
      // Built-in: run directly via node (no npx, no network)
      config = { command: builtinCommand.command, args: builtinCommand.args, env: { ...env } };
      mcpLogger.info(`Using built-in MCP server: ${entry.name}`, { command: builtinCommand.command, args: builtinCommand.args });
    } else {
      // Fallback to npx (for custom/third-party servers or when bundled package is missing)
      config = { ...entry.config, env: { ...entry.config.env, ...env } };
      mcpLogger.info(`Using npx-based MCP server: ${entry.name}`, { config });
    }

    // Apply timeout to prevent permanent hang
    // - npx-based: 180s timeout for npm network downloads
    // - built-in:  90s timeout (some servers like Playwright need browser detection)
    // - Playwright special: warn about missing Chromium
    const NPX_TIMEOUT = 180000;
    const BUILTIN_TIMEOUT = 90000;
    const addServerPromise = mcpManager.addServer(entry.name, config);

    let result: any;
    const timeoutMs = builtinCommand ? BUILTIN_TIMEOUT : NPX_TIMEOUT;
    const timeoutMsg = entry.id === 'playwright'
      ? `Playwright MCP连接超时(${BUILTIN_TIMEOUT / 1000}s) — 请确保Chromium已正确安装`
      : `连接超时(${timeoutMs / 1000}s)`;
    
    result = await Promise.race([
      addServerPromise,
      new Promise<{success: boolean; clientId?: string; serverName?: string; error?: string}>((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs)
      ),
    ]);

    if (result.success) {
      const savedConfig = loadMcpConfig();
      savedConfig[entry.name] = config;
      saveMcpConfig(savedConfig);
      return {
        success: true,
        builtin: !!builtinCommand,
        serverInfo: result.client?.serverInfo,
        tools: result.client?.tools.map((t) => ({ name: t.name, description: t.description })),
      };
    }

    return {
      success: false,
      error: `安装失败: ${result.error}`,
      errorCategory: result.errorCategory,
    };
  });

  ipcMain.handle('mcp:install', async (_event, { name, version, source }: {
    name: string;
    version: string;
    source: string;
  }) => {
    mcpLogger.info('Installing MCP service', { name, version, source });

    try {
      // 🔴 FIX: Check if service is already installed on filesystem before proceeding
      const installPath = join(mcpInstaller.getInstallDir(), name);
      if (existsSync(installPath)) {
        return {
          success: false,
          error: `服务 ${name} 已安装在 ${installPath}，请先卸载`,
        };
      }

      const installResult = await mcpInstaller.install({
        name,
        version,
        source,
        platform: [process.platform]
      }, (progress) => {
        // 🔴 FIX: Check if mainWindow is still alive before sending
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mcp:install-progress', progress);
        }
      });

      return {
        success: installResult.success,
        error: installResult.error,
        installPath: installResult.installPath
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      mcpLogger.error('MCP installation failed', err);
      return {
        success: false,
        error: err.message
      };
    }
  });

  ipcMain.handle('mcp:cancel-install', async (_event, { name }: { name: string }) => {
    const cancelled = mcpInstaller.cancel(name);
    return { cancelled };
  });
}

function getMarketplaceEntries() {
  return [
    {
      id: 'github',
      name: 'github',
      publisher: 'ModelContextProtocol',
      stars: 5000,
      description: 'GitHub API集成，用于仓库管理、Issue、PR操作',
      category: '开发工具',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] } as McpServerConfig,
      requiredEnv: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
    },
    {
      id: 'fetch',
      name: 'fetch',
      publisher: 'ModelContextProtocol',
      stars: 3000,
      description: '网页内容抓取，将HTML转换为Markdown',
      category: '数据获取',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'] } as McpServerConfig,
      requiredEnv: [],
    },
    {
      id: 'filesystem',
      name: 'filesystem',
      publisher: 'ModelContextProtocol',
      stars: 4000,
      description: '本地文件系统操作，读写文件和目录',
      category: '开发工具',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] } as McpServerConfig,
      requiredEnv: [],
    },
    {
      id: 'weather',
      name: 'weather',
      publisher: 'h1deya',
      stars: 500,
      description: '天气数据查询，支持全球城市天气和预警',
      category: '数据获取',
      config: { command: 'npx', args: ['-y', '@h1deya/mcp-server-weather'] } as McpServerConfig,
      requiredEnv: [],
    },
    {
      id: 'memory',
      name: 'memory',
      publisher: 'ModelContextProtocol',
      stars: 2000,
      description: '知识图谱记忆存储，持久化对话上下文',
      category: 'AI工具',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] } as McpServerConfig,
      requiredEnv: [],
    },
    {
      id: 'brave-search',
      name: 'brave-search',
      publisher: 'ModelContextProtocol',
      stars: 1500,
      description: 'Brave搜索引擎集成，网络搜索和本地搜索',
      category: '数据获取',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'] } as McpServerConfig,
      requiredEnv: ['BRAVE_API_KEY'],
    },
    {
      id: 'sequential-thinking',
      name: 'sequential-thinking',
      publisher: 'ModelContextProtocol',
      stars: 1800,
      description: '思维链推理增强，支持多步推理和思维可视化',
      category: 'AI工具',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] } as McpServerConfig,
      requiredEnv: [],
    },
    // 🆕 v1.11.0: All marketplace MCPs built-in
    {
      id: 'playwright',
      name: 'playwright',
      publisher: 'Microsoft',
      stars: 5500,
      description: '浏览器自动化，支持页面交互、截图和数据抓取',
      category: '开发工具',
      config: { command: 'npx', args: ['-y', '@playwright/mcp'] } as McpServerConfig,
      requiredEnv: [],
    },
    {
      id: 'context7',
      name: 'context7',
      publisher: 'Upstash',
      stars: 5200,
      description: '从库中获取最新版本文档和代码示例，帮助开发人员获得准确答案',
      category: '数据获取',
      config: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] } as McpServerConfig,
      requiredEnv: ['CONTEXT7_API_KEY'],
    },
    {
      id: 'postgres',
      name: 'postgres',
      publisher: 'ModelContextProtocol',
      stars: 1900,
      description: 'PostgreSQL数据库连接，支持查询执行、表结构探索和数据管理',
      category: '数据库',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres'] } as McpServerConfig,
      requiredEnv: ['DATABASE_URL'],
    },
    {
      id: 'redis',
      name: 'redis',
      publisher: 'ModelContextProtocol',
      stars: 1300,
      description: 'Redis数据库连接，支持键值操作、数据结构管理和缓存功能',
      category: '数据库',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-redis'] } as McpServerConfig,
      requiredEnv: ['REDIS_URL'],
    },
    {
      id: 'slack',
      name: 'slack',
      publisher: 'ModelContextProtocol',
      stars: 1600,
      description: 'Slack集成，支持频道管理、消息发送和工作区交互',
      category: '通讯',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'] } as McpServerConfig,
      requiredEnv: ['SLACK_BOT_TOKEN'],
    },
    {
      id: 'gdrive',
      name: 'gdrive',
      publisher: 'ModelContextProtocol',
      stars: 1400,
      description: 'Google Drive集成，支持文件搜索、读取和管理云端文档',
      category: '云存储',
      config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-gdrive'] } as McpServerConfig,
      requiredEnv: ['GOOGLE_CREDENTIALS'],
    },
    {
      id: 'figma',
      name: 'figma',
      publisher: 'Framelink',
      stars: 1100,
      description: '通过 Figma API 获取设计文件数据和图片资源的 MCP 服务器 (⚠️ npm包 framelink-figma-mcp 暂不可用)',
      category: '设计工具',
      config: { command: 'npx', args: ['-y', 'framelink-figma-mcp'] } as McpServerConfig,
      requiredEnv: [],
    },
  ];
}
