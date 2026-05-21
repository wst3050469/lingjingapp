export interface PROptions {
    title: string;
    body: string;
    base?: string;
    draft?: boolean;
}
export declare function isGhAvailable(): Promise<boolean>;
export declare function createPR(cwd: string, options: PROptions): Promise<string>;
export declare function getPRStatus(cwd: string): Promise<string>;
export declare function getPRView(cwd: string, prNumber?: string): Promise<string>;
//# sourceMappingURL=pr.d.ts.map