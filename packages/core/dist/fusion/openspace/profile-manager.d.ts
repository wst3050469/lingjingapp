import type { OpenSpaceProfile } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus } from '../event-bus/types.js';
export interface IFileSystem {
    readdir(path: string): Promise<string[]>;
    readFile(path: string, encoding: string): Promise<string>;
    writeFile(path: string, data: string, encoding: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
    stat(path: string): Promise<{
        isDirectory(): boolean;
    }>;
}
export declare class OpenSpaceProfileManager {
    private fs;
    private bridge;
    private eventBus;
    private profileCache;
    private currentProfile;
    constructor(fs?: IFileSystem, bridge?: OpenSpaceBridge, eventBus?: IEventBus);
    get presetProfiles(): OpenSpaceProfile[];
    listProfiles(dataDir: string): Promise<OpenSpaceProfile[]>;
    loadProfile(name: string): Promise<OpenSpaceProfile>;
    saveProfile(profile: OpenSpaceProfile): Promise<void>;
    applyProfile(name: string): Promise<void>;
    getAvailableModules(dataDir: string): Promise<string[]>;
    notifyReload(): Promise<void>;
    getCurrentProfile(): string | null;
    setBridge(bridge: OpenSpaceBridge): void;
    setFileSystem(fs: IFileSystem): void;
    private readProfileFromDir;
    private generateSceneContent;
    private formatLuaValue;
    private joinPath;
}
//# sourceMappingURL=profile-manager.d.ts.map