import type { AgentPreset } from './types.js';
export declare const AGENT_PRESETS: Record<string, AgentPreset>;
export declare const EXPERT_PRESETS: Record<string, AgentPreset>;
export declare function getPreset(name: string): AgentPreset | undefined;
export declare function getExpertPreset(name: string): AgentPreset | undefined;
export declare function getExpertPresets(): AgentPreset[];
export declare function listPresets(): AgentPreset[];
//# sourceMappingURL=presets.d.ts.map