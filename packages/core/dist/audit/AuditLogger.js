import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuditAction, AuditCategory, AuditSeverity, } from './types.js';
export class AuditLogger {
    logDir;
    maxFileSize;
    bufferSize;
    flushInterval;
    flushSize;
    constructor(logDir = './logs/audit', options = {}) {
        this.logDir = resolve(logDir);
        this.maxFileSize = options.maxFileSize || 50 * 1024 * 1024;
        this.bufferSize = [];
        this.flushSize = options.flushSize || 100;
        this.flushInterval = null;
        if (!existsSync(this.logDir)) {
            mkdir(this.logDir, { recursive: true }).catch(() => { });
        }
    }
    start() {
        this.flushInterval = setInterval(() => {
            this.flush().catch((err) => {
                console.error('[AuditLogger] Flush error:', err.message);
            });
        }, 5000);
    }
    stop() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flush().catch(() => { });
    }
    log(entry) {
        const fullEntry = {
            id: randomUUID(),
            timestamp: new Date().toISOString(),
            ...entry,
        };
        this.bufferSize.push(fullEntry);
        if (this.bufferSize.length >= this.flushSize) {
            this.flush().catch((err) => {
                console.error('[AuditLogger] Flush error:', err.message);
            });
        }
    }
    logAuth(params) {
        this.log({
            action: params.action,
            category: AuditCategory.AUTH,
            severity: params.result === 'failure' ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
            actor: {
                userId: params.userId,
                email: params.email,
                role: params.role,
                ip: params.ip,
                userAgent: params.userAgent,
            },
            resource: { type: 'session', id: params.userId },
            details: params.details || {},
            result: params.result,
            errorMessage: params.errorMessage,
        });
    }
    logDataAccess(params) {
        this.log({
            action: params.action,
            category: AuditCategory.DATA,
            severity: params.action === AuditAction.DATA_DELETE ? AuditSeverity.HIGH : AuditSeverity.LOW,
            actor: { userId: params.userId, email: params.email, role: params.role },
            resource: { type: params.resourceType, id: params.resourceId, name: params.resourceName },
            details: params.details || {},
            result: params.result,
        });
    }
    logSystemEvent(params) {
        this.log({
            action: params.action,
            category: AuditCategory.SYSTEM,
            severity: params.severity || AuditSeverity.HIGH,
            actor: { userId: params.userId, email: params.email, role: params.role },
            resource: { type: 'system', id: 'global' },
            details: params.details,
            result: params.result,
            errorMessage: params.errorMessage,
        });
    }
    async flush() {
        if (this.bufferSize.length === 0)
            return;
        const entries = this.bufferSize.splice(0);
        const date = new Date().toISOString().split('T')[0];
        const filePath = resolve(this.logDir, `audit-${date}.ndjson`);
        const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
        try {
            await appendFile(filePath, lines, { encoding: 'utf8' });
        }
        catch (err) {
            console.error('[AuditLogger] Write error:', err);
            this.bufferSize.unshift(...entries);
        }
    }
    async query(filter) {
        return { entries: [], total: 0 };
    }
    async getStats(since) {
        return {
            total: 0,
            byAction: {},
            byCategory: {},
            bySeverity: {},
            byResult: {},
            failures: 0,
            criticalEvents: 0,
        };
    }
}
//# sourceMappingURL=AuditLogger.js.map