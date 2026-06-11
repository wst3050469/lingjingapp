import type { IEventBus } from '../event-bus/types.js';
import type { IHookRegistry, HookPoint, HookContext } from '../hook-registry/types.js';
import type { SecurityConfig, SecurityScanResult } from './types.js';
import { DEFAULT_SECURITY_CONFIG } from './types.js';
import { SecurityScanner } from './security-scanner.js';
import { ProgressiveLoader } from './progressive-loader.js';

export class SkillSecurityLoader {
  private config: SecurityConfig;
  private scanner: SecurityScanner;
  private loader: ProgressiveLoader;
  private eventBus: IEventBus | null = null;
  private hookRegistry: IHookRegistry | null = null;

  constructor(config?: Partial<SecurityConfig>) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.scanner = new SecurityScanner(this.config);
    this.loader = new ProgressiveLoader();
  }

  initialize(eventBus: IEventBus, hookRegistry: IHookRegistry): void {
    this.eventBus = eventBus;
    this.hookRegistry = hookRegistry;

    this.hookRegistry.register(
      'before_skill_load' as HookPoint,
      async (context: HookContext<{ skillPath: string; content: string }>) => {
        const { skillPath, content } = context.data;
        const scanResult = this.scanner.scan(content, skillPath);

        if (!scanResult.allowed) {
          this.eventBus?.publish('skill:blocked', {
            skillPath,
            reason: 'security_scan_failed',
            findings: scanResult.findings,
          }, 'SkillSecurityLoader');

          return {
            ...context,
            data: { ...context.data, blocked: true, scanResult },
          };
        }

        return {
          ...context,
          data: { ...context.data, scanResult },
        };
      },
      { priority: -100 }
    );
  }

  async scanAndLoad(skillPath: string, content: string): Promise<{
    scanResult: SecurityScanResult;
    metadata: import('./types.js').SkillMeta | null;
  }> {
    const scanResult = this.scanner.scan(content, skillPath);

    if (!scanResult.allowed) {
      this.eventBus?.publish('skill:blocked', {
        skillPath,
        reason: 'high_risk_detected',
        findings: scanResult.findings,
      }, 'SkillSecurityLoader');

      return { scanResult, metadata: null };
    }

    try {
      const metadata = await this.loader.loadMetadata(skillPath);
      return { scanResult, metadata };
    } catch {
      return { scanResult, metadata: null };
    }
  }

  async loadFullSkill(skillPath: string): Promise<string | null> {
    try {
      return await this.loader.loadFullContent(skillPath);
    } catch {
      return null;
    }
  }

  healthCheck(): { healthy: boolean } {
    return { healthy: this.config.enabled };
  }
}
