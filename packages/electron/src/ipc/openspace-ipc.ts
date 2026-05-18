import { ipcMain } from 'electron';
import { OpenSpaceFusionAdapter } from '../../../core/src/fusion/openspace/fusion-adapter.js';
import type { OpenSpaceBridge } from '../../../core/src/fusion/openspace/bridge.js';
import type { OpenSpaceFusionConfig } from '../../../core/src/fusion/openspace/types.js';

let _adapter: OpenSpaceFusionAdapter | null = null;

/**
 * Initialize the OpenSpace adapter with optional config.
 * Creates the adapter if not already created and calls initialize().
 * Safe to call multiple times - only initializes once.
 */
export function initOpenSpace(config?: Partial<OpenSpaceFusionConfig>): void {
  if (_adapter) return;
  _adapter = new OpenSpaceFusionAdapter();
  _adapter.initialize({ enabled: false, ...config });
}

export function setOpenSpaceAdapter(adapter: OpenSpaceFusionAdapter): void {
  _adapter = adapter;
}

function getAdapter(): OpenSpaceFusionAdapter {
  if (!_adapter) {
    throw new Error('OpenSpace adapter not initialized');
  }
  return _adapter;
}

export function registerOpenSpaceIpc(): void {
  try {
    // Auto-initialize with default (disabled) config
    initOpenSpace();
  } catch (err: any) {
    console.warn('[OpenSpace] initOpenSpace failed:', err.message);
  }

  // === Detection ===
  ipcMain.handle('openspace:detect', async () => {
    try {
      const adapter = getAdapter();
      const status = adapter.getStatus();
      return {
        success: true,
        installed: status.installed,
        compatible: status.compatible,
        processState: status.processState,
        bridgeConnected: status.bridgeConnected,
        initialized: status.initialized,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // === Start ===
  ipcMain.handle('openspace:start', async () => {
    try {
      const adapter = getAdapter();
      await adapter.start();
      const status = adapter.getStatus();
      return { success: true, status };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // === Stop ===
  ipcMain.handle('openspace:stop', async () => {
    try {
      const adapter = getAdapter();
      await adapter.stop();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // === Status ===
  ipcMain.handle('openspace:status', async () => {
    try {
      const adapter = getAdapter();
      const status = adapter.getStatus();
      return { success: true, status, adapterReady: true };
    } catch (err: any) {
      return { success: false, error: err.message, adapterReady: false };
    }
  });

  // === Execute Lua Script ===
  ipcMain.handle('openspace:execute', async (_event, { script, language, timeout }: {
    script: string;
    language?: string;
    timeout?: number;
  }) => {
    try {
      const adapter = getAdapter();
      const bridge = (adapter as any).bridgeInstance as OpenSpaceBridge | undefined;
      if (!bridge) {
        return { success: false, error: 'OpenSpace bridge not available' };
      }
      const result = await bridge.sendScript({
        script,
        language: (language ?? 'lua') as any,
        timeout: timeout ?? 30000,
      });
      return {
        success: result.success,
        result: result.result,
        error: result.error,
        duration: result.duration,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // === List Profiles ===
  ipcMain.handle('openspace:list-profiles', async () => {
    try {
      const adapter = getAdapter();
      const profileManager = (adapter as any).profileManagerInstance as any;
      const profiles = profileManager?.presetProfiles ?? [];
      return { success: true, profiles };
    } catch (err: any) {
      return { success: false, profiles: [], error: err.message };
    }
  });

  // === Load Profile ===
  ipcMain.handle('openspace:load-profile', async (_event, profileName: string) => {
    try {
      const adapter = getAdapter();
      const profileManager = (adapter as any).profileManagerInstance as any;
      if (!profileManager) {
        return { success: false, error: 'Profile manager not available' };
      }
      await profileManager.activateProfile(profileName);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
