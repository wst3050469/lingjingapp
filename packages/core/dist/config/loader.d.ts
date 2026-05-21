import { type AppConfig } from './schema.js';
export { DEFAULT_CONFIG } from './defaults.js';
export interface CliOptions {
    verbose: boolean;
    noTools: boolean;
}
export declare function loadConfig(): Promise<{
    config: AppConfig;
    cliOptions: CliOptions;
}>;
//# sourceMappingURL=loader.d.ts.map