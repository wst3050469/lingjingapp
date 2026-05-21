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
    if (auditStore.length > 10000) {
        auditStore.splice(0, auditStore.length - 10000);
    }
    return full;
}
export function queryAuditLogs(filter) {
    let results = [...auditStore];
    if (filter?.userId) {
        results = results.filter((e) => e.userId === filter.userId);
    }
    if (filter?.action) {
        results = results.filter((e) => e.action === filter.action);
    }
    if (filter?.resource) {
        results = results.filter((e) => e.resource === filter.resource);
    }
    if (filter?.result) {
        results = results.filter((e) => e.result === filter.result);
    }
    if (filter?.since) {
        results = results.filter((e) => e.timestamp >= filter.since);
    }
    if (filter?.until) {
        results = results.filter((e) => e.timestamp <= filter.until);
    }
    if (filter?.limit && results.length > filter.limit) {
        results = results.slice(0, filter.limit);
    }
    return results;
}
export function clearAuditLogs() {
    auditStore.length = 0;
}
export function getAuditLogCount() {
    return auditStore.length;
}
export function createAuditMiddleware() {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            const entry = {
                userId: req.user?.sub || 'anonymous',
                action: `${req.method} ${req.path}`,
                resource: req.path,
                result: res.statusCode < 400 ? 'success' : 'failure',
                metadata: { statusCode: res.statusCode },
            };
            createAuditLog(entry);
            return originalJson(body);
        };
        next();
    };
}
