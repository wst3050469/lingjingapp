export interface UserProfile {
  id: string;
  codingStyle: string[];
  techStack: string[];
  workflowPatterns: string[];
  modelPreferences: Record<string, string>;
  decisionHistory: Array<{ decision: string; reason: string; date: string }>;
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
  healthCheck(): { healthy: boolean };
}

export const DEFAULT_USER_MODELER_CONFIG: UserModelerConfig = {
  enabled: true,
  persistInterval: 60000,
};

export const createDefaultProfile = (id: string): UserProfile => ({
  id,
  codingStyle: [],
  techStack: [],
  workflowPatterns: [],
  modelPreferences: {},
  decisionHistory: [],
  lastUpdated: Date.now(),
});
