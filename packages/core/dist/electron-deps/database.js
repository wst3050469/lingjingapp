// Stub for vitest - real implementation is in Electron context
// Uses direct in-memory storage, bypassing SQL parsing
const store = new Map();
export function getDatabase() {
    return {
        run: (sql, ...params) => {
            const p = normalizeParams(params);
            if (/INSERT/i.test(sql)) {
                const row = {
                    id: p[0],
                    operation: p[1],
                    payload: p[2],
                    timestamp: p[3],
                    status: p[4],
                    retry_count: p[5],
                    max_retries: p[6],
                    priority: p[7],
                    metadata: p[8],
                };
                store.set(row.id, row);
            }
            else if (/UPDATE/i.test(sql)) {
                const idParam = p[p.length - 1]; // last param is always the id for WHERE id = ?
                const row = store.get(idParam);
                if (row) {
                    if (sql.includes("status = 'completed'"))
                        row.status = 'completed';
                    else if (sql.includes("status = 'failed'"))
                        row.status = 'failed';
                    else if (sql.includes("status = 'retry'")) {
                        row.status = 'retry';
                        row.retry_count = p[0];
                        row.next_retry_at = p[1];
                        row.last_error = p[2];
                    }
                    else if (sql.includes("status = 'processing'")) {
                        row.status = 'processing';
                    }
                }
            }
            else if (/DELETE/i.test(sql)) {
                store.clear();
            }
        },
        exec: (sql, ...params) => {
            const p = normalizeParams(params);
            if (/SELECT/i.test(sql)) {
                if (/COUNT\(/i.test(sql)) {
                    // Aggregate query
                    const total = store.size;
                    const pending = countByStatus('pending');
                    const processing = countByStatus('processing');
                    const completed = countByStatus('completed');
                    const failed = countByStatus('failed');
                    const timestamps = Array.from(store.values()).map(r => r.timestamp);
                    const oldest = timestamps.length > 0 ? Math.min(...timestamps) : null;
                    const newest = timestamps.length > 0 ? Math.max(...timestamps) : null;
                    return [{
                            columns: ['total', 'pending', 'processing', 'completed', 'failed', 'oldest', 'newest'],
                            values: [[total, pending, processing, completed, failed, oldest, newest]]
                        }];
                }
                else {
                    // Regular SELECT *
                    let rows = Array.from(store.values());
                    // WHERE status = 'pending' (simple equality)
                    const statusMatch = sql.match(/status\s*=\s*'(\w+)'/i);
                    if (statusMatch) {
                        rows = rows.filter(r => r.status === statusMatch[1]);
                    }
                    // WHERE id = ?  (for getItem lookups)
                    const idMatch = sql.match(/WHERE\s+id\s*=\s*\?/i);
                    if (idMatch) {
                        const paramsBeforeWhere = (sql.split('WHERE')[0].match(/\?/g) || []).length;
                        const idVal = p[paramsBeforeWhere];
                        rows = rows.filter(r => r.id === idVal);
                    }
                    // AND (next_retry_at IS NULL OR next_retry_at <= ?)
                    if (sql.includes('next_retry_at')) {
                        const leParam = p.find((_, i) => {
                            // Find param used for <= comparison
                            const beforeWhere = sql.split('next_retry_at')[0];
                            const paramsBefore = (beforeWhere.match(/\?/g) || []).length;
                            return i >= paramsBefore;
                        });
                        const limit = Number(leParam ?? Infinity);
                        rows = rows.filter(r => r.next_retry_at == null || r.next_retry_at <= limit);
                    }
                    // ORDER BY
                    const orderDesc = /ORDER\s+BY\s+\w+\s+DESC/i.test(sql);
                    // We always sort by priority DESC, timestamp ASC
                    rows.sort((a, b) => {
                        if (a.priority !== b.priority)
                            return orderDesc ? b.priority - a.priority : a.priority - b.priority;
                        return a.timestamp - b.timestamp;
                    });
                    // LIMIT
                    const limitMatch = sql.match(/LIMIT\s+(\d+|\?)/i);
                    if (limitMatch) {
                        let limit;
                        if (limitMatch[1] === '?') {
                            limit = Number(p[p.length - 1] ?? 0);
                        }
                        else {
                            limit = parseInt(limitMatch[1], 10);
                        }
                        if (limit > 0 && limit < rows.length) {
                            rows = rows.slice(0, limit);
                        }
                    }
                    const columns = ['id', 'operation', 'payload', 'timestamp', 'status', 'retry_count', 'max_retries', 'next_retry_at', 'last_error', 'priority', 'metadata'];
                    return [{
                            columns,
                            values: rows.map(r => [
                                r.id, r.operation, r.payload, r.timestamp, r.status,
                                r.retry_count, r.max_retries,
                                r.next_retry_at ?? null, r.last_error ?? null,
                                r.priority, r.metadata ?? null
                            ])
                        }];
                }
            }
            return [];
        },
        get: (_sql, ..._params) => undefined,
        all: (_sql, ..._params) => [],
    };
}
function normalizeParams(params) {
    if (params.length === 1 && Array.isArray(params[0]))
        return params[0];
    return params;
}
function countByStatus(status) {
    let count = 0;
    for (const row of store.values()) {
        if (row.status === status)
            count++;
    }
    return count;
}
export async function saveDatabase() {
    // no-op in test
}
export function resetDatabase() {
    store.clear();
}
//# sourceMappingURL=database.js.map