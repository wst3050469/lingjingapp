export { OpenSpaceBridge } from './bridge.js';
export type { IWebSocket, IWebSocketFactory } from './bridge.js';

export { OpenSpaceProcessManager } from './process-manager.js';
export type { IChildProcess, IChildProcessHandle, StateChangeCallback } from './process-manager.js';

export { OpenSpaceFusionAdapter } from './fusion-adapter.js';

export { OpenSpaceScriptGenerator } from './script-generator.js';
export { OpenSpaceProfileManager } from './profile-manager.js';
export type { IFileSystem as ProfileFileSystem } from './profile-manager.js';
export { OpenSpaceDatasetBrowser } from './dataset-browser.js';
export type { IFileSystem as DatasetFileSystem } from './dataset-browser.js';

export { OpenSpaceRenderer } from './renderer.js';
export type { IWindowManager } from './renderer.js';

export { OpenSpaceRecorder } from './recorder.js';
export type { IRecorderStorage, IDiskSpace } from './recorder.js';

export { OpenSpaceSyncManager } from './sync-manager.js';
export type { IFileSystem as SyncFileSystem, SyncProfile } from './sync-manager.js';

export { createOpenSpaceExecuteTool, createOpenSpaceQueryTool, createOpenSpaceToolSet } from './tools/index.js';
export type { OpenSpaceToolSet } from './tools/index.js';

export { reviewScript } from './security-review.js';
export { BUILTIN_TEMPLATES, matchTemplate, fillTemplate } from './script-templates.js';

export type {
  ProcessRunState,
  InstallationDetection,
  StartConfig,
  ProcessHealthStatus,
  HealthCheckResult,
  ScriptLanguage,
  OpenSpaceMessage,
  ScriptRequest,
  ScriptResult,
  BridgeConfig,
  SceneContext,
  SecurityRiskLevel,
  SecurityViolation,
  SecurityReviewResult,
  ScriptTemplate,
  OpenSpaceProfile,
  CameraPosition,
  DisplayMode,
  WindowState,
  DatasetStatus,
  DatasetEntry,
  RecordingConfig,
  RecordingState,
  RecordingSession,
  SyncRole,
  SyncState,
  SyncConnectionConfig,
  OpenSpaceEventTopic,
  OpenSpaceFusionConfig,
} from './types.js';
