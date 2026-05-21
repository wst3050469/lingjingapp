export declare class BashWhitelist {
    private safeCommands;
    private customAllowed;
    private customBlocked;
    constructor(additionalSafe?: string[]);
    isAllowed(command: string): boolean;
    isDangerous(command: string): boolean;
    addAllowed(command: string): void;
    addBlocked(command: string): void;
    private extractBaseCommand;
}
//# sourceMappingURL=bash-whitelist.d.ts.map