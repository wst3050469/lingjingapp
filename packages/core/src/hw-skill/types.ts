export type HwSkillStatus = 'installed' | 'dependency-missing' | 'version-incompatible' | 'uninstalled';
export type DrcSeverity = 'error' | 'warning' | 'info';
export type SimulationStatus = 'idle' | 'running' | 'completed' | 'failed' | 'timeout';
export type AiDesignType = 'schematic_generate' | 'pcb_layout_suggest' | 'drc_fix_suggest' | 'component_select';
export type ConfidenceLabel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  returns: Record<string, unknown>;
  cliCommand?: string;
  timeout?: number;
}

export interface FileAssociation {
  extension: string;
  mimeType: string;
  openCommand: string;
  icon?: string;
}

export interface CliDependency {
  command: string;
  versionRange: string;
  required: boolean;
  installGuide: string;
  detectionCommand: string;
}

export interface CliAvailabilityResult {
  command: string;
  available: boolean;
  version?: string;
  compatible?: boolean;
  installGuide?: string;
}

export interface HwDesignSkillMeta {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tools: ToolDeclaration[];
  fileAssociations: FileAssociation[];
  cliDependencies: CliDependency[];
  sidebarPanels: string[];
  status: HwSkillStatus;
}

export interface SkillPackageManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  author: string;
  entryPoint: string;
  cliDependencies: CliDependency[];
  fileAssociations: FileAssociation[];
  sidebarPanels: string[];
}

export interface SkillPackage {
  manifest: SkillPackageManifest;
  skillMd: string;
  toolsJson: Record<string, ToolDeclaration>;
  adapterScript: string;
  dependencies: { cli: CliDependency[] };
  securityMeta: {
    allowedCommands: string[];
    filesystemAccess: string;
    networkAccess: boolean;
    maxMemoryMB: number;
    forbiddenPatterns: string[];
  };
  checksum: string;
}

export interface DrcViolation {
  type: string;
  description: string;
  position: { x: number; y: number; layer?: string };
  severity: DrcSeverity;
  suggestion?: string;
}

export interface SimulationResult {
  status: SimulationStatus;
  duration: number;
  waveforms: WaveformPoint[][];
  errors: string[];
  warnings: string[];
}

export interface WaveformPoint {
  time: number;
  value: number;
  signal: string;
}

export interface AiDesignResult {
  id: string;
  type: AiDesignType;
  content: string;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  applied: boolean;
  drcValidated: boolean | null;
  timestamp: number;
}

export interface AiHwDesignPromptConfig {
  schematicGenerate: string;
  pcbLayoutSuggest: string;
  drcFixSuggest: string;
  componentSelect: string;
  language: 'zh' | 'en';
}

export interface CliExecuteOptions {
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
  maxBuffer?: number;
}

export interface CliExecuteResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  duration: number;
  error?: string;
}

export interface HwDesignAuditEntry {
  id: string;
  skillId: string;
  toolName: string;
  action: string;
  paramsSummary: string;
  resultStatus: 'success' | 'failure' | 'timeout' | 'cancelled';
  durationMs: number;
  sessionId: string;
}