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
    if (deps.eventBus) {
        deps.eventBus.publish('agent:message_start', {
            type: 'fusion_initialized',
            modules: initResult.initialized,
            degraded: initResult.degraded,
        }, 'fusion-initializer');
    }
    return { initResult, fusionInitializer };
}
