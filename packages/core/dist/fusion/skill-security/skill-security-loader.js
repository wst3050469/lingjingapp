import { DEFAULT_SECURITY_CONFIG } from './types.js';
import { SecurityScanner } from './security-scanner.js';
import { ProgressiveLoader } from './progressive-loader.js';
export class SkillSecurityLoader {
    config;
    scanner;
    loader;
    eventBus = null;
    hookRegistry = null;
    constructor(config) {
        this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
        this.scanner = new SecurityScanner(this.config);
        this.loader = new ProgressiveLoader();
    }
    initialize(eventBus, hookRegistry) {
        this.eventBus = eventBus;
        this.hookRegistry = hookRegistry;
        this.hookRegistry.register('before_skill_load', async (context) => {
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
        }, { priority: -100 });
    }
    async scanAndLoad(skillPath, content) {
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
        }
        catch {
            return { scanResult, metadata: null };
        }
    }
    async loadFullSkill(skillPath) {
        try {
            return await this.loader.loadFullContent(skillPath);
        }
        catch {
            return null;
        }
    }
    healthCheck() {
        return { healthy: this.config.enabled };
    }
}
//# sourceMappingURL=skill-security-loader.js.map