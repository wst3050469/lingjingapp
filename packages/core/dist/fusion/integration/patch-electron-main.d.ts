import type { BrowserWindow } from 'electron';
import type { FusionConfig, FusionInitResult } from '../types.js';
import { FusionInitializer } from '../fusion-initializer.js';
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
