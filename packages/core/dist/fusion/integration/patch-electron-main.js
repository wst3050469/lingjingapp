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
import { FusionInitializer } from '../fusion-initializer.js';
import { logger } from '../../utils/logger.js';
export async function patchElectronMain(mainWindow, fusionConfig, deps = {}) {
    const fusionInitializer = new FusionInitializer();
    if (deps.eventBus) {
        fusionInitializer.setEventBus(deps.eventBus);
    }
    if (deps.hookRegistry) {
        fusionInitializer.setHookRegistry(deps.hookRegistry);
    }
    const initResult = fusionInitializer.initialize(fusionConfig);
    if (initResult.success) {
        logger.info('[Fusion] All modules initialized successfully');
    }
    else {
        logger.warn(`[Fusion] Initialized with degraded modules: ${initResult.degraded.join(', ')}`);
        for (const failure of initResult.failed) {
            logger.error(`[Fusion] Module "${failure.module}" failed: ${failure.error}`);
        }
    }
    // Register Fusion IPC handlers
    try {
        const registerFusionIPC = deps.loadRegisterFusionIPC
            ? await deps.loadRegisterFusionIPC()
            : (await import('../../../electron/src/ipc/fusion/register.js')).registerFusionIPC;
        registerFusionIPC(mainWindow);
        logger.info('[Fusion] Fusion IPC registered');
    }
    catch (err) {
        logger.error(`[Fusion] registerFusionIPC failed: ${err.message}`);
    }
    // Register OpenSpace IPC handlers
    try {
        const registerOpenSpaceIPC = deps.loadRegisterOpenSpaceIPC
            ? await deps.loadRegisterOpenSpaceIPC()
            : (await import('../../../electron/src/ipc/fusion/openspace-register.js')).registerOpenSpaceIPC;
        registerOpenSpaceIPC(mainWindow);
        logger.info('[Fusion] OpenSpace IPC registered');
    }
    catch (err) {
        logger.warn(`[Fusion] registerOpenSpaceIPC skipped or failed: ${err.message}`);
    }
    // Publish initialization event
    if (deps.eventBus) {
        deps.eventBus.publish('agent:message_start', {
            type: 'fusion_initialized',
            modules: initResult.initialized,
            degraded: initResult.degraded,
        }, 'fusion-initializer');
    }
    return { initResult, fusionInitializer };
}
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
//# sourceMappingURL=patch-electron-main.js.map