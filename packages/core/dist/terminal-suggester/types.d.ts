export type CommandType = 'install' | 'build' | 'test' | 'deploy' | 'lint' | 'custom';
export type RiskLevel = 'safe' | 'caution' | 'dangerous';
export interface TerminalSuggestion {
    command: string;
    description: string;
    type: CommandType;
    riskLevel: RiskLevel;
    estimatedTime?: string;
    projectContext?: ProjectContext;
}
export interface ProjectContext {
    packageManager: string;
    hasPackageJson: boolean;
    scripts: Record<string, string>;
    language: string;
}
export interface DangerousCommandPattern {
    pattern: RegExp;
    description: string;
    riskLevel: RiskLevel;
}
//# sourceMappingURL=types.d.ts.map