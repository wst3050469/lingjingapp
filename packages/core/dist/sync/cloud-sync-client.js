import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import { cloudSyncClient } from '../electron-deps/http-client.js';
import { getDatabase, saveDatabase } from '../electron-deps/database.js';
import { OfflineQueue } from './offline-queue.js';
import { DEFAULT_SYNC_CONFIG, SyncStatus } from '../types/sync.types.js';
export class CloudSyncClient {
    deviceId;
    config;
    offlineQueue;
    lastSyncTimestamp = 0;
    syncing = false;
    listeners = new Map();
    constructor(deviceId, config = {}) {
        this.deviceId = deviceId;
        this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
        this.offlineQueue = new OfflineQueue();
    }
    async syncIncremental() {
        if (this.syncing) {
            throw new Error('Sync already in progress');
        }
        this.syncing = true;
        this.emit('sync-start', {});
        try {
            const request = {
                deviceId: this.deviceId,
                lastSyncTimestamp: this.lastSyncTimestamp,
                dataTypes: this.config.dataTypes
            };
            const localChanges = await this.getLocalChanges();
            const response = await cloudSyncClient.post('/api/sync/delta', {
                request,
                changes: localChanges
            });
            await this.applyRemoteChanges(response.changes);
            await this.markLocalSynced(localChanges.map(c => c.id));
            this.lastSyncTimestamp = response.serverTimestamp;
            await this.saveSyncTimestamp();
            this.emit('sync-complete', {
                changes: response.changes.length,
                timestamp: response.serverTimestamp
            });
            return response;
        }
        catch (err) {
            console.error('[CloudSync] Sync failed:', err);
            this.emit('sync-error', { error: err });
            throw err;
        }
        finally {
            this.syncing = false;
        }
    }
    async pushData(dataType, operation, payload) {
        const checksum = this.calculateChecksum(payload);
        const syncData = {
            id: uuidv4(),
            dataType,
            operation,
            version: Date.now(),
            timestamp: Date.now(),
            deviceId: this.deviceId,
            payload,
            checksum,
            status: SyncStatus.PENDING
        };
        await this.saveLocalChange(syncData);
        if (this.config.autoSync) {
            try {
                await this.syncIncremental();
            }
            catch {
                await this.offlineQueue.enqueue('sync-push', syncData, 0);
            }
        }
        else {
            await this.offlineQueue.enqueue('sync-push', syncData, 0);
        }
        return syncData;
    }
    async pullData(dataType, dataId) {
        try {
            const response = await cloudSyncClient.get(`/api/sync/data/${dataType}/${dataId}`);
            return response;
        }
        catch (err) {
            console.error(`[CloudSync] Failed to pull ${dataType}/${dataId}:`, err);
            return null;
        }
    }
    async getLocalChanges() {
        const db = getDatabase();
        const rows = db.exec(`SELECT * FROM sync_data 
       WHERE status = 'pending' AND device_id = ?
       ORDER BY timestamp ASC`, [this.deviceId]);
        if (rows.length === 0 || rows[0].values.length === 0) {
            return [];
        }
        return rows[0].values.map((row) => this.rowToSyncData(row));
    }
    async applyRemoteChanges(changes) {
        const db = getDatabase();
        for (const change of changes) {
            const existing = db.exec(`SELECT * FROM sync_data WHERE id = ?`, [change.id]);
            if (existing.length > 0 && existing[0].values.length > 0) {
                this.emit('conflict', { local: existing[0].values[0], remote: change });
                continue;
            }
            db.run(`INSERT OR REPLACE INTO sync_data (
          id, data_type, operation, version, timestamp, device_id, payload, checksum, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')`, [
                change.id,
                change.dataType,
                change.operation,
                change.version,
                change.timestamp,
                change.deviceId,
                JSON.stringify(change.payload),
                change.checksum
            ]);
        }
        await saveDatabase();
    }
    async saveLocalChange(data) {
        const db = getDatabase();
        db.run(`INSERT INTO sync_data (
        id, data_type, operation, version, timestamp, device_id, payload, checksum, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            data.id,
            data.dataType,
            data.operation,
            data.version,
            data.timestamp,
            data.deviceId,
            JSON.stringify(data.payload),
            data.checksum,
            data.status
        ]);
        await saveDatabase();
    }
    async markLocalSynced(ids) {
        if (ids.length === 0)
            return;
        const db = getDatabase();
        const placeholders = ids.map(() => '?').join(',');
        db.run(`UPDATE sync_data SET status = 'synced', updated_at = datetime('now') 
       WHERE id IN (${placeholders})`, ids);
        await saveDatabase();
    }
    async saveSyncTimestamp() {
        const db = getDatabase();
        db.run(`INSERT OR REPLACE INTO sync_data (id, data_type, operation, version, timestamp, device_id, payload, checksum, status)
       VALUES ('sync_timestamp', 'settings', 'update', ?, ?, ?, ?, '', 'synced')`, [this.lastSyncTimestamp, this.lastSyncTimestamp, this.deviceId, JSON.stringify({ timestamp: this.lastSyncTimestamp })]);
        await saveDatabase();
    }
    calculateChecksum(data) {
        return createHash('sha256')
            .update(JSON.stringify(data))
            .digest('hex')
            .substring(0, 32);
    }
    rowToSyncData(row) {
        return {
            id: row[0],
            dataType: row[1],
            operation: row[2],
            version: row[3],
            timestamp: row[4],
            deviceId: row[5],
            payload: JSON.parse(row[6]),
            checksum: row[7],
            status: row[8]
        };
    }
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
    }
    off(event, handler) {
        this.listeners.get(event)?.delete(handler);
    }
    emit(event, data) {
        this.listeners.get(event)?.forEach(handler => handler(data));
    }
    async getSyncProgress() {
        const stats = await this.offlineQueue.getStats();
        return {
            total: stats.pending + stats.processing,
            completed: stats.completed,
            failed: stats.failed,
            speed: 0
        };
    }
}
//# sourceMappingURL=cloud-sync-client.js.map