import type { DatasetEntry } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus } from '../event-bus/types.js';
export interface IFileSystem {
    readdir(path: string): Promise<string[]>;
    readFile(path: string, encoding: string): Promise<string>;
    exists(path: string): Promise<boolean>;
    stat(path: string): Promise<{
        isDirectory(): boolean;
    }>;
}
export declare class OpenSpaceDatasetBrowser {
    private fs;
    private bridge;
    private eventBus;
    private datasetsCache;
    private lastScanTime;
    private readonly cacheTtl;
    constructor(fs?: IFileSystem, bridge?: OpenSpaceBridge, eventBus?: IEventBus);
    scanDatasets(dataDir: string): Promise<DatasetEntry[]>;
    getDatasetInfo(name: string): DatasetEntry;
    loadDataset(name: string): Promise<void>;
    unloadDataset(name: string): Promise<void>;
    searchDatasets(query: string): DatasetEntry[];
    getLoadedDatasets(): DatasetEntry[];
    clearCache(): void;
    setBridge(bridge: OpenSpaceBridge): void;
    setFileSystem(fs: IFileSystem): void;
    private isCacheValid;
    private scanDirectory;
    private joinPath;
}
//# sourceMappingURL=dataset-browser.d.ts.map