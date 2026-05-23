import { IpcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import {
  OpenSpaceProcessManager,
  OpenSpaceBridge,
  OpenSpaceScriptGenerator,
  OpenSpaceProfileManager,
  OpenSpaceDatasetBrowser,
  OpenSpaceRecorder,
  OpenSpaceSyncManager,
  OpenSpaceRenderer,
} from '@codepilot/core';

export class OpenSpaceIPCHandler {
  private ipcMain: IpcMain;
  private processManager: OpenSpaceProcessManager;
  private bridge: OpenSpaceBridge;
  private scriptGenerator: OpenSpaceScriptGenerator;
  private profileManager: OpenSpaceProfileManager;
  private datasetBrowser: OpenSpaceDatasetBrowser;
  private recorder: OpenSpaceRecorder;
  private syncManager: OpenSpaceSyncManager;
  private renderer: OpenSpaceRenderer;

  constructor(
    ipcMain: IpcMain,
    processManager: OpenSpaceProcessManager,
    bridge: OpenSpaceBridge,
    scriptGenerator: OpenSpaceScriptGenerator,
    profileManager: OpenSpaceProfileManager,
    datasetBrowser: OpenSpaceDatasetBrowser,
    recorder: OpenSpaceRecorder,
    syncManager: OpenSpaceSyncManager,
    renderer: OpenSpaceRenderer
  ) {
    this.ipcMain = ipcMain;
    this.processManager = processManager;
    this.bridge = bridge;
    this.scriptGenerator = scriptGenerator;
    this.profileManager = profileManager;
    this.datasetBrowser = datasetBrowser;
    this.recorder = recorder;
    this.syncManager = syncManager;
    this.renderer = renderer;
  }

  registerHandlers(): void {
    // Process management
    this.ipcMain.handle('openspace:detect', () => this.processManager.detectInstallation());
    this.ipcMain.handle('openspace:start', () => this.processManager.start());
    this.ipcMain.handle('openspace:stop', () => this.processManager.stop());
    this.ipcMain.handle('openspace:restart', () => this.processManager.restart());
    this.ipcMain.handle('openspace:getStatus', () => ({
      state: this.processManager.currentState,
      healthy: this.processManager.isHealthy(),
    }));

    // Bridge communication
    this.ipcMain.handle('openspace:connect', (_e, port?: number) => this.bridge.connect(port));
    this.ipcMain.handle('openspace:disconnect', () => this.bridge.disconnect());
    this.ipcMain.handle('openspace:sendScript', (_e, script: string, language?: string) =>
      this.bridge.sendScript(script, language));

    // Script generation
    this.ipcMain.handle('openspace:generateScript', (_e, request: any) =>
      this.scriptGenerator.generate(request));

    // Profile management
    this.ipcMain.handle('openspace:getProfiles', () => this.profileManager.getProfiles());
    this.ipcMain.handle('openspace:saveProfile', (_e, profile: any) =>
      this.profileManager.saveProfile(profile));
    this.ipcMain.handle('openspace:deleteProfile', (_e, id: string) =>
      this.profileManager.deleteProfile(id));
    this.ipcMain.handle('openspace:applyProfile', (_e, id: string) =>
      this.profileManager.applyProfile(id));

    // Dataset browsing
    this.ipcMain.handle('openspace:listDatasets', () => this.datasetBrowser.listDatasets());
    this.ipcMain.handle('openspace:loadDataset', (_e, path: string) =>
      this.datasetBrowser.loadDataset(path));

    // Recording
    this.ipcMain.handle('openspace:startRecording', () => this.recorder.startRecording());
    this.ipcMain.handle('openspace:stopRecording', () => this.recorder.stopRecording());
    this.ipcMain.handle('openspace:listRecordings', () => this.recorder.listRecordings());
    this.ipcMain.handle('openspace:playRecording', (_e, id: string) =>
      this.recorder.playRecording(id));

    // Sync
    this.ipcMain.handle('openspace:syncStart', (_e, config: any) => this.syncManager.startSync(config));
    this.ipcMain.handle('openspace:syncStop', () => this.syncManager.stopSync());
    this.ipcMain.handle('openspace:syncStatus', () => this.syncManager.getStatus());

    // Renderer
    this.ipcMain.handle('openspace:getRendererInfo', () => this.renderer.getInfo());
    this.ipcMain.handle('openspace:setDisplayMode', (_e, mode: string) =>
      this.renderer.setDisplayMode(mode as any));
  }
}
