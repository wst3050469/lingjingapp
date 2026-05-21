/**
 * Audit Log Patch — Batch D (P1)
 *
 * Provides audit logging for cloud-server API endpoints.
 * Each API endpoint should wrap with createAuditMiddleware().
 */
const auditStore = [];
let entryCounter = 0;
function generateId() {
    entryCounter += 1;
    return `audit-${Date.now()}-${entryCounter.toString(36).padStart(4, '0')}`;
}
export function createAuditLog(entry) {
    const full = {
        id: generateId(),
        userId: entry.userId,
        action: entry.action,
        resource: entry.resource,
        result: entry.result,
        timestamp: Date.now(),
        metadata: entry.metadata,
    };
    auditStore.push(full);
    return full;
}
export function queryAuditLogs(filter = {}) {
    let results = auditStore;
    if (filter.userId)
        results = results.filter((e) => e.userId === filter.userId);
    if (filter.action)
        results = results.filter((e) => e.action === filter.action);
    if (filter.resource)
        results = results.filter((e) => e.resource === filter.resource);
    if (filter.result)
        results = results.filter((e) => e.result === filter.result);
    if (filter.fromTimestamp)
        results = results.filter((e) => e.timestamp >= filter.fromTimestamp);
    if (filter.toTimestamp)
        results = results.filter((e) => e.timestamp <= filter.toTimestamp);
    results = results.sort((a, b) => b.timestamp - a.timestamp);
    if (filter.limit && filter.limit > 0)
        results = results.slice(0, filter.limit);
    return results;
}
export function clearAuditLogs() {
    auditStore.length = 0;
    entryCounter = 0;
}
export function getAuditLogCount() {
    return auditStore.length;
}
export function createAuditMiddleware() {
    return (req, res, next) => {
        const startTime = Date.now();
        const userId = req.user?.sub ?? 'anonymous';
        const resource = req.path.replace(/^\//, '').split('/')[0] || 'unknown';
        next();
        const result = res.statusCode < 400 ? 'success' : res.statusCode === 403 ? 'denied' : 'failure';
        createAuditLog({
            userId,
            action: req.method,
            resource,
            result,
            metadata: { durationMs: Date.now() - startTime, statusCode: res.statusCode },
        });
    };
}
//# sourceMappingURL=patch-audit-log.js.map