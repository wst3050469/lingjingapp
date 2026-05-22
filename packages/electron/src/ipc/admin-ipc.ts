/**
 * Admin IPC Bridge — exposes admin modules (auth, version, mcp, quest, config, log)
 * to the renderer process for the SaaS admin dashboard.
 */
import { ipcMain, app } from 'electron';
import { createLogger } from '../monitoring/logger';

const logger = createLogger('admin-ipc');

// Lazy-loaded admin module instances (initialized on first use to avoid startup overhead)
let _authManager: any = null;
let _versionModule: any = null;
let _mcpModule: any = null;
let _questModule: any = null;
let _configModule: any = null;
let _logModule: any = null;

async function getAuthManager(): Promise<any> {
  if (!_authManager) {
    const { AdminAuthManager } = await import('../admin/admin-auth.js');
    _authManager = new AdminAuthManager();
  }
  return _authManager;
}

async function getVersionModule(): Promise<any> {
  if (!_versionModule) {
    const { VersionModule } = await import('../admin/version-module.js');
    _versionModule = new VersionModule(app.getVersion());
  }
  return _versionModule;
}

async function getMcpModule(): Promise<any> {
  if (!_mcpModule) {
    const { MCPModule } = await import('../admin/mcp-module.js');
    _mcpModule = new MCPModule();
  }
  return _mcpModule;
}

async function getQuestModule(): Promise<any> {
  if (!_questModule) {
    const { QuestModule } = await import('../admin/quest-module.js');
    _questModule = new QuestModule();
  }
  return _questModule;
}

async function getConfigModule(): Promise<any> {
  if (!_configModule) {
    const { ConfigModule } = await import('../admin/config-module.js');
    _configModule = new ConfigModule();
  }
  return _configModule;
}

async function getLogModule(): Promise<any> {
  if (!_logModule) {
    const { LogModule } = await import('../admin/log-module.js');
    _logModule = new LogModule();
  }
  return _logModule;
}

export function registerAdminIpc(): void {
  // ─── Auth handlers ───

  ipcMain.handle('admin:auth:login', async (_event, { username, password }: { username: string; password: string }) => {
    try {
      const auth = await getAuthManager();
      const result = await auth.authenticate(username, password);
      if (!result) {
        return { success: false, error: '用户名或密码错误' };
      }
      return { success: true, user: result.user, tokens: result.tokens };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('admin:auth:login failed', err instanceof Error ? err : new Error(message));
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:auth:verify', async (_event, { token }: { token: string }) => {
    try {
      const auth = await getAuthManager();
      const payload = auth.verifyAccessToken(token);
      return { success: true, payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:auth:refresh', async (_event, { refreshToken }: { refreshToken: string }) => {
    try {
      const auth = await getAuthManager();
      const tokens = await auth.refreshAccessToken(refreshToken);
      return { success: true, tokens };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:auth:has-permission', async (_event, { token, permission }: { token: string; permission: string }) => {
    try {
      const auth = await getAuthManager();
      const payload = auth.verifyAccessToken(token);
      const granted = auth.hasPermission(payload, permission);
      return { success: true, granted };
    } catch (err) {
      return { success: false, granted: false };
    }
  });

  ipcMain.handle('admin:auth:create-user', async (_event, { username, password, role }: { username: string; password: string; role: string }) => {
    try {
      const auth = await getAuthManager();
      const user = await auth.createUser(username, password, role);
      return { success: true, user };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:auth:list-users', async () => {
    try {
      const auth = await getAuthManager();
      const users = auth.listUsers ? auth.listUsers() : [];
      return { success: true, users };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message, users: [] };
    }
  });

  // ─── Version handlers ───

  ipcMain.handle('admin:version:check', async () => {
    try {
      const vm = await getVersionModule();
      const result = await vm.checkForUpdates();
      return { success: true, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:version:history', async (_event, { limit, offset }: { limit?: number; offset?: number }) => {
    try {
      const vm = await getVersionModule();
      const history = await vm.getVersionHistory(limit || 20, offset || 0);
      return { success: true, history };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:version:release-info', async (_event, { version }: { version: string }) => {
    try {
      const vm = await getVersionModule();
      const info = await vm.getReleaseInfo(version);
      return { success: true, info };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:version:current', async () => {
    try {
      const vm = await getVersionModule();
      const current = vm.getCurrentVersion();
      return { success: true, version: current };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:version:set-channel', async (_event, { channel }: { channel: string }) => {
    try {
      const vm = await getVersionModule();
      vm.setChannel(channel);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ─── MCP handlers ───

  ipcMain.handle('admin:mcp:list-services', async () => {
    try {
      const mm = await getMcpModule();
      const services = mm.listServices();
      return { success: true, services };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:mcp:get-service', async (_event, { name }: { name: string }) => {
    try {
      const mm = await getMcpModule();
      const service = mm.getService(name);
      return { success: true, service };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:mcp:install', async (_event, { id, env }: { id: string; env?: Record<string, string> }) => {
    try {
      const mm = await getMcpModule();
      const result = await mm.installFromMarketplace(id, env || {});
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:mcp:uninstall', async (_event, { name }: { name: string }) => {
    try {
      const mm = await getMcpModule();
      await mm.uninstallService(name);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:mcp:update', async (_event, { name }: { name: string }) => {
    try {
      const mm = await getMcpModule();
      const result = await mm.updateService(name);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:mcp:marketplace', async () => {
    try {
      const mm = await getMcpModule();
      const entries = mm.listMarketplace();
      return { success: true, entries };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ─── Quest handlers ───

  ipcMain.handle('admin:quest:list-tasks', async (_event, filter?: any) => {
    try {
      const qm = await getQuestModule();
      const tasks = await qm.listTasks(filter || {});
      return { success: true, tasks };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:quest:get-task', async (_event, { taskId }: { taskId: string }) => {
    try {
      const qm = await getQuestModule();
      const task = await qm.getTask(taskId);
      return { success: true, task };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:quest:conversation', async (_event, { taskId }: { taskId: string }) => {
    try {
      const qm = await getQuestModule();
      const conversation = await qm.getConversation(taskId);
      return { success: true, conversation };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:quest:stats', async () => {
    try {
      const qm = await getQuestModule();
      const stats = await qm.getStats();
      return { success: true, stats };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:quest:pause', async (_event, { taskId }: { taskId: string }) => {
    try {
      const qm = await getQuestModule();
      const result = await qm.pauseTask(taskId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  });

  ipcMain.handle('admin:quest:resume', async (_event, { taskId }: { taskId: string }) => {
    try {
      const qm = await getQuestModule();
      const result = await qm.resumeTask(taskId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  });

  ipcMain.handle('admin:quest:cancel', async (_event, { taskId }: { taskId: string }) => {
    try {
      const qm = await getQuestModule();
      const result = await qm.cancelTask(taskId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  });

  // ─── Config handlers ───

  ipcMain.handle('admin:config:get', async () => {
    try {
      const cm = await getConfigModule();
      const config = cm.getConfig();
      return { success: true, config };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:config:update', async (_event, { section, key, value }: { section: string; key: string; value: any }) => {
    try {
      const cm = await getConfigModule();
      const config = cm.updateConfig(section, key, value);
      return { success: true, config };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:config:reset', async () => {
    try {
      const cm = await getConfigModule();
      const config = cm.resetToDefaults();
      return { success: true, config };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:config:export', async () => {
    try {
      const cm = await getConfigModule();
      const json = cm.exportConfig();
      return { success: true, json };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:config:import', async (_event, { json }: { json: string }) => {
    try {
      const cm = await getConfigModule();
      const config = cm.importConfig(json);
      return { success: true, config };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ─── Log handlers ───

  ipcMain.handle('admin:log:query', async (_event, filter?: any) => {
    try {
      const lm = await getLogModule();
      const logs = lm.queryLogs(filter || {});
      return { success: true, logs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:log:stats', async () => {
    try {
      const lm = await getLogModule();
      const stats = lm.getStats();
      return { success: true, stats };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:log:clean', async (_event, { olderThan }: { olderThan?: number }) => {
    try {
      const lm = await getLogModule();
      const cleaned = lm.cleanLogs(olderThan);
      return { success: true, cleaned };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('admin:log:export', async (_event, filter?: any) => {
    try {
      const lm = await getLogModule();
      const data = lm.exportLogs(filter || {});
      return { success: true, data };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  logger.info('Admin IPC handlers registered (6 modules, 30+ channels)');
}
