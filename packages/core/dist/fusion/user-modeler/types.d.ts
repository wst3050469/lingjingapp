export interface UserProfile {
    id: string;
    codingStyle: string[];
    techStack: string[];
    workflowPatterns: string[];
    modelPreferences: Record<string, string>;
    decisionHistory: Array<{
        decision: string;
        reason: string;
        date: string;
    }>;
    lastUpdated: number;
}
export interface UserModelerConfig {
    enabled: boolean;
    persistInterval: number;
}
export type ReflectCallback = (currentModel: UserProfile) => Promise<Partial<UserProfile>>;
export interface IHonchoUserModeler {
    updateUserModel(incremental: Partial<UserProfile>): void;
    getCurrentModel(): UserProfile;
    triggerReflection(): Promise<void>;
    healthCheck(): {
        healthy: boolean;
    };
}
export declare const DEFAULT_USER_MODELER_CONFIG: UserModelerConfig;
export declare const createDefaultProfile: (id: string) => UserProfile;
//# sourceMappingURL=types.d.ts.map