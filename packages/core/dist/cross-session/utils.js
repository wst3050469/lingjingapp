import { createHash } from 'node:crypto';
export function computeChecksum(data) {
    const json = JSON.stringify(data);
    return createHash('sha256').update(json).digest('hex');
}
export function verifyChecksum(data, expectedChecksum) {
    return computeChecksum(data) === expectedChecksum;
}
export function generateSnapshotId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `ss_${ts}_${rand}`;
}
export function generateIncrementalId() {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `is_${ts}_${rand}`;
}
//# sourceMappingURL=utils.js.map