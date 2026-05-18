/* eslint-disable @typescript-eslint/no-explicit-any */
// Module declarations for external dependencies

// @lingjing/core is a shared types package
declare module '@lingjing/core' {
  // ── Plan ──
  export interface Plan {
    id: string;
    name: string;
    price: number;
    billingCycle: 'monthly' | 'yearly' | 'quarterly';
    features: PlanFeatureDefinition[];
    limits: PlanLimits;
    recommended?: boolean;
  }
  export interface PlanFeatureDefinition {
    name: string;
    description?: string;
    included: boolean;
    limit?: number | 'unlimited';
  }
  export interface PlanLimits {
    apiCalls: number | 'unlimited';
    storage: number;
    workflows: number | 'unlimited';
    devices: number;
  }

  // ── Subscription ──
  export interface Subscription {
    id: string;
    userId: string;
    planId: string;
    planName: string;
    status: 'active' | 'inactive' | 'expired' | 'cancelled';
    startedAt: string;
    expiresAt: string;
    autoRenew: boolean;
    features: PlanFeature[];
    usage: UsageStats;
  }
  export interface PlanFeature {
    name: string;
    limit: number | 'unlimited';
    used: number;
    unit: string;
  }
  export interface UsageStats {
    apiCalls: number;
    storageUsed: number;
    workflowsRun: number;
    devicesConnected: number;
  }

  // ── Device ──
  export interface Device {
    id: string;
    name: string;
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    lastSyncAt: string;
    syncStatus: 'syncing' | 'synced' | 'offline' | 'error';
    isOnline: boolean;
    authorizationStatus: 'authorized' | 'pending' | 'revoked';
    boundAt: string;
    isCurrentDevice: boolean;
  }
  export interface AuthorizationCode {
    code: string;
    deviceId: string;
    createdAt: string;
    expiresAt: string;
    status: 'pending' | 'used' | 'expired';
  }

  // ── Storage ──
  export interface StorageStats {
    total: number;
    used: number;
    available: number;
    breakdown: StorageBreakdown;
  }
  export interface StorageBreakdown {
    conversations: number;
    files: number;
    workflows: number;
    cache: number;
    other: number;
  }
  export interface StorageFile {
    id: string;
    name: string;
    path: string;
    size: number;
    type: string;
    createdAt: string;
    modifiedAt: string;
    category: 'conversation' | 'workflow' | 'cache' | 'file' | 'other';
  }

  // ── Sync ──
  export interface CloudSyncStatus {
    enabled: boolean;
    lastSyncAt: string;
    status: 'syncing' | 'synced' | 'error' | 'conflict';
    progress?: CloudSyncProgress;
  }
  export interface CloudSyncProgress {
    total: number;
    completed: number;
    failed: number;
    current?: string;
    speed?: number;
  }
  export interface CloudSyncRecord {
    id: string;
    timestamp: string;
    dataType: string;
    operation: 'create' | 'update' | 'delete';
    status: 'success' | 'failed' | 'conflict';
    size: number;
    deviceId: string;
  }

  // ── User ──
  export interface LoginRecord {
    id: string;
    timestamp: string;
    ipAddress: string;
    location: string;
    device: string;
    success: boolean;
    failureReason?: string;
  }
  export interface SecuritySettings {
    twoFactorEnabled: boolean;
    twoFactorMethod?: 'authenticator' | 'sms' | 'email';
    sessionTimeout: number;
    loginNotification: boolean;
    trustedDevices: string[];
  }
  export interface UserInfo {
    id: string;
    username: string;
    email: string;
    avatar?: string;
    registeredAt: string;
    lastLoginAt?: string;
    passwordStrength: 'weak' | 'medium' | 'strong';
    twoFactorEnabled: boolean;
  }

  // ── API Key ──
  export interface ApiKey {
    id: string;
    name: string;
    key: string;
    maskedKey: string;
    permissions: string[];
    createdAt: string;
    expiresAt?: string;
    status: 'active' | 'disabled' | 'expired';
    lastUsedAt?: string;
    callCount: number;
    errorCount: number;
  }
  export interface ApiKeyStats {
    totalKeys: number;
    activeKeys: number;
    totalCalls: number;
    totalErrors: number;
    avgCallsPerDay: number;
    lastActiveAt?: string;
  }

  // ── Generic ──
  export interface CloudManagementError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
  }
  export interface CleanupSuggestion {
    category: string;
    description: string;
    size: number;
    fileCount: number;
    safeToDelete: boolean;
  }
}

// Window.electron alias (some code uses window.electron directly)
declare interface Window {
  electron: {
    ipcRenderer: {
      on: (channel: string, listener: (...args: any[]) => void) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    };
  };
}

// 'require' in renderer (for dynamic imports)
declare var require: (module: string) => any;
