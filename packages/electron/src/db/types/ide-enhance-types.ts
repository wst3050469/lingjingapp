export type BugSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type BugStatus = 'open' | 'fixing' | 'fixed' | 'verified' | 'wontfix';

export interface BugRecord {
  id: string;
  severity: BugSeverity;
  module: string;
  title: string;
  description: string;
  status: BugStatus;
  fixDescription: string;
  affectedFiles: string[];
  createdAt: string;
  updatedAt: string;
}

export type SkillCategory = 'code_generation' | 'testing' | 'review' | 'deployment' | 'custom';
export type SkillSecurityStatus = 'pending' | 'approved' | 'rejected' | 'scanning';
export type SkillInstallationStatus = 'active' | 'disabled' | 'uninstalled' | 'scan_failed';

export interface SkillMetaRecord {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  author: string;
  version: string;
  iconUrl: string;
  rating: number;
  installCount: number;
  securityStatus: SkillSecurityStatus;
  dependencies: string[];
  entryPoint: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SkillInstallation {
  id: string;
  skillId: string;
  userId: string;
  installedVersion: string;
  installPath: string;
  securityScanResult: Record<string, unknown>;
  status: SkillInstallationStatus;
  installedAt: string;
  updatedAt: string;
}

export interface SessionCheckpoint {
  sessionId: string;
  type: 'chat' | 'quest';
  status: string;
  taskTitle?: string;
  conversationJson: string;
  configSnapshotJson: string;
  checkpointStep: number;
  checkpointTimestamp: number;
  turnCount: number;
  providerId: string;
  workspacePath: string;
  toolRegistrySnapshot: string;
  lastActivityAt: number;
  createdAt: string;
  updatedAt: string;
}

export type PushNotificationType = 'approval' | 'question' | 'instruction_wait' | 'task_complete' | 'task_failed';
export type PushDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface PushNotification {
  id: string;
  type: PushNotificationType;
  sessionId: string;
  deviceId: string;
  title: string;
  summary: string;
  deliveryStatus: PushDeliveryStatus;
  retryCount: number;
  payload: Record<string, unknown>;
  createdAt: string;
  deliveredAt?: string;
}

export type DeviceType = 'ios' | 'android';

export interface DeviceRegistration {
  id: string;
  userId: string;
  deviceType: DeviceType;
  deviceName: string;
  pushToken: string;
  isActive: boolean;
  appVersion: string;
  lastConnectedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSummary {
  sessionId: string;
  title: string;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  recentAction: string;
  keyOutputs: string[];
  status: 'running' | 'paused' | 'completed' | 'failed';
  updatedAt: number;
}