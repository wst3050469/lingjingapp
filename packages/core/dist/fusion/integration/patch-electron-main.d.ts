/**
 * FusionInitializer + Fusion IPC Integration Patch for Electron Main Process
 *
 * INJECTION TARGET: packages/electron/src/main.ts
 * INJECTION POINT: After `registerFusionIPC(mainWindow)` call (line ~916)
 *
 * This patch provides the complete initialization sequence for the Hermes Fusion
 * subsystem in the Electron main process. It should be called after the
 * BrowserWindow is created and IPC handlers are being registered.
 *
 * Current state in main.ts (line 914-919):
 *   // Fusion IPC
 *   try {
 *     registerFusionIPC(mainWindow);
 *   } catch (err) {
 *     console.error('[Main] registerFusionIPC failed:', err);
 *   }
 *
 * Replace with:
 *   import { patchElectronMain } from '@codepilot/core/fusion/integration/patch-electron-main.js';
 *   // In the IPC registration section:
 *   try {
 *     patchElectronMain(mainWindow, fusionConfig);
 *   } catch (err) {
 *     console.error('[Main] Fusion integration failed:', err);
 *   }
 */
import type { BrowserWindow } from 'electron';
import { FusionInitializer } from '../fusion-initializer.js';
import type { FusionConfig } from '../types.js';
import type { FusionInitResult } from '../fusion-initializer.js';
import type { IEventBus } from '../event-bus/types.js';
import type { IHookRegistry } from '../hook-registry/types.js';
interface PatchElectronMainDeps {
    eventBus?: IEventBus;
    hookRegistry?: IHookRegistry;
    loadRegisterFusionIPC?: () => Promise<(mainWindow: BrowserWindow) => void>;
    loadRegisterOpenSpaceIPC?: () => Promise<(mainWindow: BrowserWindow) => void>;
}
export interface PatchElectronMainResult {
    initResult: FusionInitResult;
    fusionInitializer: FusionInitializer;
}
export declare function patchElectronMain(mainWindow: BrowserWindow, fusionConfig: FusionConfig, deps?: PatchElectronMainDeps): Promise<PatchElectronMainResult>;
export {};
/**
 * DATABASE MIGRATION INJECTION:
 *
 * INJECTION TARGET: packages/electron/src/db/database.ts
 * INJECTION POINT: After `db.run(migration002)` (line ~320)
 *
 * Add the following lines:
 *
 *   // Run Hermes Fusion migrations
 *   const { migration003 } = await import('./migrations/migration003_hermes_fusion');
 *   db.run(migration003);
 *
 *   // Run OpenSpace Fusion migrations (migration004)
 *   const { getMigration004SQL } = await import('@codepilot/core/fusion/integration/patch-database.js');
 *   db.run(getMigration004SQL());
 *
 * If migration004 file is created at packages/electron/src/database/migrations/migration004_openspace_fusion.ts,
 * import it directly instead:
 *
 *   const { migration004 } = await import('./migrations/migration004_openspace_fusion');
 *   db.run(migration004);
 */
//# sourceMappingURL=patch-electron-main.d.ts.map