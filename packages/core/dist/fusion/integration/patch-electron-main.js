"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchElectronMain = patchElectronMain;
const fusion_initializer_js_1 = require("../fusion-initializer.js");
const logger_js_1 = require("../../utils/logger.js");
async function patchElectronMain(mainWindow, fusionConfig, deps = {}) {
    const fusionInitializer = new fusion_initializer_js_1.FusionInitializer();
    if (deps.eventBus) {
        fusionInitializer.setEventBus(deps.eventBus);
    }
    if (deps.hookRegistry) {
        fusionInitializer.setHookRegistry(deps.hookRegistry);
    }
    const initResult = fusionInitializer.initialize(fusionConfig);
    if (initResult.success) {
        logger_js_1.logger.info('[Fusion] All modules initialized successfully');
    }
    else {
        logger_js_1.logger.warn(`[Fusion] Initialized with degraded modules: ${initResult.degraded.join(', ')}`);
        for (const failure of initResult.failed) {
            logger_js_1.logger.error(`[Fusion] Module "${failure.module}" failed: ${failure.error}`);
        }
    }
    // Register Fusion IPC handlers
    try {
        const registerFusionIPC = deps.loadRegisterFusionIPC
            ? await deps.loadRegisterFusionIPC()
            : (await Promise.resolve().then(() => __importStar(require('../../../electron/src/ipc/fusion/register.js')))).registerFusionIPC;
        registerFusionIPC(mainWindow);
        logger_js_1.logger.info('[Fusion] Fusion IPC registered');
    }
    catch (err) {
        logger_js_1.logger.error(`[Fusion] registerFusionIPC failed: ${err.message}`);
    }
    // Register OpenSpace IPC handlers
    try {
        const registerOpenSpaceIPC = deps.loadRegisterOpenSpaceIPC
            ? await deps.loadRegisterOpenSpaceIPC()
            : (await Promise.resolve().then(() => __importStar(require('../../../electron/src/ipc/fusion/openspace-register.js')))).registerOpenSpaceIPC;
        registerOpenSpaceIPC(mainWindow);
        logger_js_1.logger.info('[Fusion] OpenSpace IPC registered');
    }
    catch (err) {
        logger_js_1.logger.warn(`[Fusion] registerOpenSpaceIPC skipped or failed: ${err.message}`);
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