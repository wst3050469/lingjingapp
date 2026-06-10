import { logger } from '../../utils/logger.js';
export class OpenSpaceSyncManager {
    bridge;
    fs;
    eventBus;
    status = {
        state: 'disconnected',
        role: 'none',
        serverAddress: '',
        port: 0,
        latency: 0,
        clientCount: 0,
    };
    profileCache = new Map();
    statusMonitorInterval = null;
    constructor(fs, bridge, eventBus) {
        this.fs = fs ?? null;
        this.bridge = bridge ?? null;
        this.eventBus = eventBus ?? null;
    }
    get currentStatus() {
        return { ...this.status };
    }
    /**
     * Connect to an OpenSpace sync server.
     */
    async connect(config) {
        if (!this.bridge?.isConnected) {
            throw new Error('OpenSpace bridge not connected');
        }
        this.status.state = 'connecting';
        this.status.serverAddress = config.host;
        this.status.port = config.port;
        const authArg = config.password ? `, "${config.password}"` : '';
        const script = `openspace.sync.connect("${config.host}", ${config.port}${authArg})`;
        const result = await this.bridge.sendScript({
            script,
            language: 'lua',
            timeout: 15000,
        });
        if (!result.success) {
            this.status.state = 'error';
            this.publishEvent('openspace:sync_failed', {
                host: config.host,
                port: config.port,
                error: result.error ?? 'connection failed',
                timestamp: Date.now(),
            });
            logger.error(`[SyncManager] connect failed: ${result.error}`);
            return;
        }
        this.status.state = 'connected';
        this.publishEvent('openspace:sync_connected', {
            host: config.host,
            port: config.port,
            timestamp: Date.now(),
        });
        // Start status monitoring
        this.startStatusMonitor();
        logger.info(`[SyncManager] connected to ${config.host}:${config.port}`);
    }
    /**
     * Disconnect from the sync server.
     */
    async disconnect() {
        this.stopStatusMonitor();
        if (this.bridge?.isConnected) {
            await this.bridge.sendScript({
                script: 'openspace.sync.disconnect()',
                language: 'lua',
                timeout: 5000,
            });
        }
        this.status.state = 'disconnected';
        this.status.role = 'none';
        this.publishEvent('openspace:sync_disconnected', {
            timestamp: Date.now(),
        });
        logger.info('[SyncManager] disconnected');
    }
    /**
     * Change sync role (Host/Client/None).
     */
    async setRole(role) {
        if (!this.bridge?.isConnected) {
            throw new Error('OpenSpace bridge not connected');
        }
        const result = await this.bridge.sendScript({
            script: `openspace.sync.setRole("${role}")`,
            language: 'lua',
            timeout: 5000,
        });
        if (!result.success) {
            logger.warn(`[SyncManager] setRole failed: ${result.error}`);
            return;
        }
        this.status.role = role;
        logger.info(`[SyncManager] role changed to: ${role}`);
    }
    /**
     * Get current sync status.
     */
    getStatus() {
        return { ...this.status };
    }
    /**
     * List saved sync profiles.
     */
    async listProfiles() {
        if (!this.fs)
            return [...this.profileCache.values()];
        const profilesDir = '.openspace/sync-profiles';
        try {
            const exists = await this.fs.exists(profilesDir);
            if (!exists)
                return [...this.profileCache.values()];
            const entries = await this.fs.readdir(profilesDir);
            const profiles = [];
            for (const entry of entries) {
                if (!entry.endsWith('.json'))
                    continue;
                const filePath = `${profilesDir}/${entry}`;
                try {
                    const raw = await this.fs.readFile(filePath, 'utf-8');
                    const profile = JSON.parse(raw);
                    this.profileCache.set(profile.name, profile);
                    profiles.push(profile);
                }
                catch {
                    logger.warn(`[SyncManager] failed to read profile: ${entry}`);
                }
            }
            return profiles;
        }
        catch (err) {
            logger.warn(`[SyncManager] failed to list profiles: ${err.message}`);
            return [...this.profileCache.values()];
        }
    }
    /**
     * Create a new sync profile.
     */
    async createProfile(name, config) {
        const now = new Date().toISOString();
        const profile = {
            name,
            ...config,
            createdAt: now,
            updatedAt: now,
        };
        if (this.fs) {
            const profilesDir = '.openspace/sync-profiles';
            await this.fs.mkdir(profilesDir, { recursive: true });
            const filePath = `${profilesDir}/${name}.json`;
            await this.fs.writeFile(filePath, JSON.stringify(profile, null, 2), 'utf-8');
        }
        this.profileCache.set(name, profile);
        logger.info(`[SyncManager] created profile: ${name}`);
        return profile;
    }
    /**
     * Delete a sync profile.
     */
    async deleteProfile(name) {
        this.profileCache.delete(name);
        if (this.fs) {
            const filePath = `.openspace/sync-profiles/${name}.json`;
            try {
                const exists = await this.fs.exists(filePath);
                if (exists) {
                    await this.fs.writeFile(filePath, '', 'utf-8'); // Clear content
                }
            }
            catch {
                // ignore
            }
        }
        logger.info(`[SyncManager] deleted profile: ${name}`);
    }
    setBridge(bridge) {
        this.bridge = bridge;
    }
    setFileSystem(fs) {
        this.fs = fs;
    }
    dispose() {
        this.stopStatusMonitor();
        this.profileCache.clear();
        this.status.state = 'disconnected';
    }
    startStatusMonitor() {
        if (this.statusMonitorInterval)
            return;
        this.statusMonitorInterval = setInterval(async () => {
            if (!this.bridge?.isConnected)
                return;
            try {
                // Fetch sync status from OpenSpace via property queries
                await this.bridge.sendScript({
                    script: 'openspace.getPropertyValue("Sync.Latency")',
                    language: 'lua',
                    timeout: 3000,
                });
            }
            catch {
                // Monitor errors are non-critical
            }
        }, 5000);
    }
    stopStatusMonitor() {
        if (this.statusMonitorInterval) {
            clearInterval(this.statusMonitorInterval);
            this.statusMonitorInterval = null;
        }
    }
    publishEvent(topic, data) {
        if (this.eventBus) {
            this.eventBus.publish(topic, data, 'openspace-sync-manager');
        }
    }
}
//# sourceMappingURL=sync-manager.js.map