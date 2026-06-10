import { createLogger } from '../monitoring/logger';

const logger = createLogger('session-isolation-manager');

export class SessionIsolationManager {
  private isolatedProviders = new Map<string, any>();
  private isolatedConfigs = new Map<string, any>();
  private isolatedTools = new Map<string, any>();

  createIsolatedProvider(sessionId: string, baseProvider: any): any {
    const isolated = Object.create(Object.getPrototypeOf(baseProvider));
    Object.assign(isolated, baseProvider);
    this.isolatedProviders.set(sessionId, isolated);
    logger.debug('Isolated provider created', { sessionId });
    return isolated;
  }

  createIsolatedConfig(sessionId: string, baseConfig: any): any {
    const isolated = structuredClone(baseConfig);
    this.isolatedConfigs.set(sessionId, isolated);
    logger.debug('Isolated config created', { sessionId });
    return isolated;
  }

  createIsolatedTools(sessionId: string, baseTools: any): any {
    const isolated = Object.create(Object.getPrototypeOf(baseTools));
    Object.assign(isolated, baseTools);
    this.isolatedTools.set(sessionId, isolated);
    logger.debug('Isolated tools created', { sessionId });
    return isolated;
  }

  validateIsolation(sessionId: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!this.isolatedProviders.has(sessionId)) issues.push('No isolated provider');
    if (!this.isolatedConfigs.has(sessionId)) issues.push('No isolated config');
    if (!this.isolatedTools.has(sessionId)) issues.push('No isolated tools');
    return { valid: issues.length === 0, issues };
  }

  cleanup(sessionId: string): void {
    this.isolatedProviders.delete(sessionId);
    this.isolatedConfigs.delete(sessionId);
    this.isolatedTools.delete(sessionId);
    logger.debug('Isolation cleaned up', { sessionId });
  }
}

export const sessionIsolationManager = new SessionIsolationManager();