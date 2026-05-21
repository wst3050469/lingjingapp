export interface BashOutputEntry {
    commandId: string;
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    startedAt: number;
    completedAt: number;
}
export declare function generateCommandId(): string;
export declare function storeBashOutput(entry: BashOutputEntry): void;
export declare function getBashOutput(commandId: string): BashOutputEntry | undefined;
export declare function listBashOutputs(): BashOutputEntry[];
//# sourceMappingURL=bash-output-store.d.ts.map