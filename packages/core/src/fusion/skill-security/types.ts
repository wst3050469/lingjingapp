export interface SecurityConfig {
  enabled: boolean;
  blockOnHighRisk: boolean;
  warnOnMediumRisk: boolean;
  scanRules: string[];
}

export type SecurityRisk = 'command_injection' | 'path_traversal' | 'privilege_escalation' | 'data_leakage';

export interface SecurityFinding {
  type: SecurityRisk;
  severity: 'high' | 'medium' | 'low';
  description: string;
  location: string;
}

export interface SecurityScanResult {
  skillPath: string;
  findings: SecurityFinding[];
  riskLevel: 'high' | 'medium' | 'low' | 'none';
  allowed: boolean;
}

export interface SkillMeta {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  level: string;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enabled: true,
  blockOnHighRisk: true,
  warnOnMediumRisk: true,
  scanRules: ['command_injection', 'path_traversal', 'privilege_escalation', 'data_leakage'],
};
