import type { BrowserWindow } from 'electron';
import { ipcMain } from 'electron';
import { openspace } from '@codepilot/core/fusion';

export function registerOpenSpaceIPC(mainWindow: BrowserWindow): void {
  // ── Process Management ──────────────
  ipcMain.handle('openspace:detect', async () => {
    try {
      const PM = openspace.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      const result = pm.detectInstallation();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:setPath', async (_event, path: string) => {
    try {
      const PM = openspace.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      // @ts-ignore - setInstallationPath exists at runtime
      pm.setInstallationPath(path);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:start', async (_event, config) => {
    try {
      const PM = openspace.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      const result = await pm.start(config);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:stop', async (_event, processId) => {
    try {
      const PM = openspace.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      // @ts-ignore - stop may accept processId at runtime
      await pm.stop(processId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:health', async () => {
    try {
      const PM = openspace.OpenSpaceProcessManager;
      if (!PM) return { success: false, error: 'OpenSpaceProcessManager not available' };
      const pm = new PM();
      const result = await pm.healthCheck();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Communication ────────────────────
  ipcMain.handle('openspace:execute', async (_event, request) => {
    try {
      const Bridge = openspace.OpenSpaceBridge;
      if (!Bridge) return { success: false, error: 'OpenSpaceBridge not available' };
      const bridge = new Bridge();
      const result = await bridge.sendScript(request);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Script Generation ────────────────
  ipcMain.handle('openspace:generateScript', async (_event, params: { prompt: string; language?: string }) => {
    try {
      const Gen = openspace.OpenSpaceScriptGenerator;
      if (!Gen) return { success: false, error: 'OpenSpaceScriptGenerator not available' };
      const gen = new Gen();
      // @ts-ignore - generate may accept language at runtime
      const result = await gen.generate(params.prompt, params.language);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:getTemplates', async () => {
    try {
      const Gen = openspace.OpenSpaceScriptGenerator;
      if (!Gen) return { success: false, error: 'OpenSpaceScriptGenerator not available' };
      const gen = new Gen();
      // @ts-ignore - getTemplates exists at runtime
      const templates = gen.getTemplates();
      return { success: true, data: templates };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Profile Management ───────────────
  ipcMain.handle('openspace:profile:list', async (_event, dataDir?: string) => {
    try {
      const Mgr = openspace.OpenSpaceProfileManager;
      if (!Mgr) return { success: false, error: 'OpenSpaceProfileManager not available' };
      const mgr = new Mgr();
      const profiles = await mgr.listProfiles(dataDir ?? '.');
      return { success: true, data: profiles };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:profile:get', async (_event, name: string) => {
    try {
      const Mgr = openspace.OpenSpaceProfileManager;
      if (!Mgr) return { success: false, error: 'OpenSpaceProfileManager not available' };
      const mgr = new Mgr();
      const profile = await mgr.loadProfile(name);
      return { success: true, data: profile };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:profile:create', async (_event, profile) => {
    try {
      const Mgr = openspace.OpenSpaceProfileManager;
      if (!Mgr) return { success: false, error: 'OpenSpaceProfileManager not available' };
      const mgr = new Mgr();
      await mgr.saveProfile(profile);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:profile:update', async (_event, profile) => {
    try {
      const Mgr = openspace.OpenSpaceProfileManager;
      if (!Mgr) return { success: false, error: 'OpenSpaceProfileManager not available' };
      const mgr = new Mgr();
      await mgr.saveProfile(profile);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:profile:delete', async (_event, name: string) => {
    try {
      const Mgr = openspace.OpenSpaceProfileManager;
      if (!Mgr) return { success: false, error: 'OpenSpaceProfileManager not available' };
      const mgr = new Mgr();
      // @ts-ignore - deleteProfile exists on sync-manager at runtime
      await mgr.deleteProfile(name);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:profile:hotReload', async () => {
    try {
      const Mgr = openspace.OpenSpaceProfileManager;
      if (!Mgr) return { success: false, error: 'OpenSpaceProfileManager not available' };
      const mgr = new Mgr();
      await mgr.notifyReload();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Renderer ──────────────────────────
  ipcMain.handle('openspace:renderer:setMode', async (_event, mode: string) => {
    try {
      const Renderer = openspace.OpenSpaceRenderer;
      if (!Renderer) return { success: false, error: 'OpenSpaceRenderer not available' };
      const renderer = new Renderer();
      await renderer.setMode(mode as any);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:renderer:setDisplay', async (_event, displayId: number) => {
    try {
      const Renderer = openspace.OpenSpaceRenderer;
      if (!Renderer) return { success: false, error: 'OpenSpaceRenderer not available' };
      const renderer = new Renderer();
      await renderer.setDisplay(displayId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Dataset Management ────────────────
  ipcMain.handle('openspace:dataset:scan', async (_event, dataDir: string) => {
    try {
      const Browser = openspace.OpenSpaceDatasetBrowser;
      if (!Browser) return { success: false, error: 'OpenSpaceDatasetBrowser not available' };
      const browser = new Browser();
      const datasets = await browser.scanDatasets(dataDir);
      return { success: true, data: datasets };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:dataset:search', async (_event, query: string) => {
    try {
      const Browser = openspace.OpenSpaceDatasetBrowser;
      if (!Browser) return { success: false, error: 'OpenSpaceDatasetBrowser not available' };
      const browser = new Browser();
      const results = browser.searchDatasets(query);
      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:dataset:load', async (_event, name: string) => {
    try {
      const Browser = openspace.OpenSpaceDatasetBrowser;
      if (!Browser) return { success: false, error: 'OpenSpaceDatasetBrowser not available' };
      const browser = new Browser();
      await browser.loadDataset(name);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:dataset:unload', async (_event, name: string) => {
    try {
      const Browser = openspace.OpenSpaceDatasetBrowser;
      if (!Browser) return { success: false, error: 'OpenSpaceDatasetBrowser not available' };
      const browser = new Browser();
      await browser.unloadDataset(name);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Recording ─────────────────────────
  ipcMain.handle('openspace:recording:start', async (_event, config) => {
    try {
      const Recorder = openspace.OpenSpaceRecorder;
      if (!Recorder) return { success: false, error: 'OpenSpaceRecorder not available' };
      const recorder = new Recorder();
      await recorder.startRecording(config);
      return { success: true, data: recorder.currentState };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:recording:stop', async () => {
    try {
      const Recorder = openspace.OpenSpaceRecorder;
      if (!Recorder) return { success: false, error: 'OpenSpaceRecorder not available' };
      const recorder = new Recorder();
      const session = await recorder.stopRecording();
      return { success: true, data: session };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:recording:pause', async () => {
    try {
      const Recorder = openspace.OpenSpaceRecorder;
      if (!Recorder) return { success: false, error: 'OpenSpaceRecorder not available' };
      const recorder = new Recorder();
      await recorder.pauseRecording();
      return { success: true, data: recorder.currentState };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:recording:sessions', async () => {
    try {
      const Recorder = openspace.OpenSpaceRecorder;
      if (!Recorder) return { success: false, error: 'OpenSpaceRecorder not available' };
      const recorder = new Recorder();
      const sessions = await recorder.getSessions();
      return { success: true, data: sessions };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Sync ──────────────────────────────
  ipcMain.handle('openspace:sync:connect', async (_event, config) => {
    try {
      const Sync = openspace.OpenSpaceSyncManager;
      if (!Sync) return { success: false, error: 'OpenSpaceSyncManager not available' };
      const sync = new Sync();
      await sync.connect(config);
      return { success: true, data: sync.getStatus() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:sync:disconnect', async () => {
    try {
      const Sync = openspace.OpenSpaceSyncManager;
      if (!Sync) return { success: false, error: 'OpenSpaceSyncManager not available' };
      const sync = new Sync();
      await sync.disconnect();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle('openspace:sync:status', async () => {
    try {
      const Sync = openspace.OpenSpaceSyncManager;
      if (!Sync) return { success: false, error: 'OpenSpaceSyncManager not available' };
      const sync = new Sync();
      return { success: true, data: sync.getStatus() };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  // ── Event Subscription ────────────────
  ipcMain.on('openspace:subscribe', (_event) => {
    // Main → Renderer state push: webContents.send('openspace:stateChange', data)
    // Subscribed renderer will receive state updates via EventBus → webContents bridge
  });
}
