export type ProcessRunState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface InstallationDetection {
  found: boolean;
  path?: string;
  version?: string;
  compatible: boolean;
  method?: string;
}

export interface StartConfig {
  profile?: string;
  windowless?: boolean;
  additionalArgs?: string[];
  wsPort?: number;
}

export interface ProcessHealthStatus {
  alive: boolean;
  wsConnected: boolean;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  state: ProcessRunState;
  details: ProcessHealthStatus;
  lastChecked: number;
}

export type ScriptLanguage = 'lua' | 'javascript' | 'python';

export interface OpenSpaceMessage {
  jsonrpc: '2.0';
  id: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface ScriptRequest {
  script: string;
  language: ScriptLanguage;
  timeout?: number;
}

export interface ScriptResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export interface BridgeConfig {
  wsPort: number;
  wsHost: string;
  connectTimeout: number;
  commandTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

export type SecurityRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface SecurityViolation {
  pattern: string;
  line: number;
  description: string;
  riskLevel: SecurityRiskLevel;
}

export interface SecurityReviewResult {
  passed: boolean;
  riskLevel: SecurityRiskLevel;
  violations: SecurityViolation[];
}

export interface ScriptTemplate {
  name: string;
  category: string;
  description: string;
  keywords: string[];
  scriptTemplate: string;
  highRisk: boolean;
  language: ScriptLanguage;
}

export interface OpenSpaceProfile {
  name: string;
  path: string;
  modules: string[];
  metadata: Record<string, string>;
}

export interface CameraPosition {
  position: [number, number, number];
  rotation: [number, number, number];
}

export type DisplayMode = 'embedded' | 'standalone' | 'fullscreen';

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  focused: boolean;
}

export type DatasetStatus = 'loaded' | 'unloaded' | 'loading' | 'error';

export interface DatasetEntry {
  name: string;
  path: string;
  status: DatasetStatus;
  type: string;
  metadata?: Record<string, string>;
}

export interface RecordingConfig {
  fps: number;
  resolution: [number, number];
  outputDir: string;
  format: 'png' | 'jpg';
}

export type RecordingState = 'idle' | 'recording' | 'paused';

export interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  config: RecordingConfig;
  frameCount: number;
}

export type SyncRole = 'presenter' | 'audience' | 'none';

export interface SyncConnectionConfig {
  host: string;
  port: number;
  role: SyncRole;
  password?: string;
}

export type SyncState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SceneContext {
  currentTime: string;
  cameraPosition: CameraPosition;
  loadedModules: string[];
  activeBodies: string[];
}

export interface OpenSpaceFusionConfig {
  enabled: boolean;
  installationPath?: string;
  autoStart: boolean;
  startConfig: StartConfig;
  bridgeConfig: BridgeConfig;
  displayMode: DisplayMode;
}

export type OpenSpaceEventTopic =
  | 'openspace:started'
  | 'openspace:stopped'
  | 'openspace:script_executed'
  | 'openspace:script_failed'
  | 'openspace:scene_changed'
  | 'openspace:scene_loaded'
  | 'openspace:property_changed'
  | 'openspace:recording_started'
  | 'openspace:recording_stopped'
  | 'openspace:recording_paused'
  | 'openspace:sync_connected'
  | 'openspace:sync_disconnected'
  | 'openspace:sync_failed'
  | 'openspace:health_changed'
  | 'openspace:script_generated'
  | 'openspace:profile_loaded'
  | 'openspace:dataset_loaded'
  | 'openspace:dataset_unloaded'
  | 'openspace:window_changed'
  | 'openspace:embed_fallback'
  | 'openspace:skills_available'
  | 'openspace:skills_unavailable';
