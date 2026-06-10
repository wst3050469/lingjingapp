import { logger } from '../../utils/logger.js';
const DEFAULT_RECORDING_CONFIG = {
    fps: 30,
    resolution: [1920, 1080],
    outputDir: '',
    format: 'png',
};
const MIN_DISK_SPACE_BYTES = 500 * 1024 * 1024; // 500MB minimum
export class OpenSpaceRecorder {
    config;
    state = 'idle';
    bridge;
    storage;
    diskChecker;
    eventBus;
    currentSession = null;
    startTimestamp = 0;
    frameCount = 0;
    diskMonitorInterval = null;
    playback = {
        playing: false,
        currentFrame: 0,
        totalFrames: 0,
        speed: 1,
        sessionId: null,
        timeline: [],
    };
    playbackTimer = null;
    constructor(config, bridge, storage, diskChecker, eventBus) {
        this.config = { ...DEFAULT_RECORDING_CONFIG, ...config };
        this.bridge = bridge ?? null;
        this.storage = storage ?? null;
        this.diskChecker = diskChecker ?? null;
        this.eventBus = eventBus ?? null;
    }
    get currentState() {
        return this.state;
    }
    /**
     * Start recording: configure frame export and begin capturing.
     */
    async startRecording(config) {
        if (this.state !== 'idle') {
            throw new Error(`Cannot start recording: current state is "${this.state}"`);
        }
        if (!this.bridge?.isConnected) {
            throw new Error('OpenSpace bridge not connected');
        }
        if (config) {
            this.config = { ...this.config, ...config };
        }
        // Check disk space
        if (this.diskChecker && this.config.outputDir) {
            const freeSpace = await this.diskChecker.getFreeSpace(this.config.outputDir);
            if (freeSpace < MIN_DISK_SPACE_BYTES) {
                throw new Error(`Insufficient disk space: ${Math.round(freeSpace / 1024 / 1024)}MB available, ${MIN_DISK_SPACE_BYTES / 1024 / 1024}MB required`);
            }
        }
        // Configure OpenSpace frame export
        const setupScript = [
            `openspace.setPropertyValue("FrameExport.Enabled", true)`,
            `openspace.setPropertyValue("FrameExport.Resolution", "${this.config.resolution[0]}x${this.config.resolution[1]}")`,
            `openspace.setPropertyValue("FrameExport.Framerate", ${this.config.fps})`,
            `openspace.setPropertyValue("FrameExport.Format", "${this.config.format}")`,
        ];
        if (this.config.outputDir) {
            setupScript.push(`openspace.setPropertyValue("FrameExport.OutputDirectory", "${this.config.outputDir.replace(/\\/g, '/')}")`);
        }
        await this.bridge.sendScript({
            script: setupScript.join('\n'),
            language: 'lua',
            timeout: 10000,
        });
        // Create session
        this.startTimestamp = Date.now();
        this.frameCount = 0;
        this.state = 'recording';
        this.currentSession = {
            id: `rec_${this.startTimestamp}`,
            startTime: this.startTimestamp,
            config: { ...this.config },
            frameCount: 0,
        };
        // Start disk space monitoring
        if (this.diskChecker && this.config.outputDir) {
            this.diskMonitorInterval = setInterval(async () => {
                try {
                    const freeSpace = await this.diskChecker.getFreeSpace(this.config.outputDir);
                    if (freeSpace < MIN_DISK_SPACE_BYTES) {
                        logger.warn('[OpenSpaceRecorder] Low disk space, auto-stopping recording');
                        await this.stopRecording();
                    }
                }
                catch {
                    // ignore monitor errors
                }
            }, 10000);
        }
        this.publishEvent('openspace:recording_started', {
            session: this.currentSession,
            timestamp: Date.now(),
        });
        logger.info('[OpenSpaceRecorder] recording started');
    }
    /**
     * Stop recording and persist session metadata.
     */
    async stopRecording() {
        if (this.state !== 'recording' && this.state !== 'paused') {
            throw new Error(`Cannot stop recording: current state is "${this.state}"`);
        }
        // Disable frame export
        if (this.bridge?.isConnected) {
            await this.bridge.sendScript({
                script: 'openspace.setPropertyValue("FrameExport.Enabled", false)',
                language: 'lua',
                timeout: 5000,
            });
        }
        // Stop disk monitor
        if (this.diskMonitorInterval) {
            clearInterval(this.diskMonitorInterval);
            this.diskMonitorInterval = null;
        }
        if (this.currentSession) {
            this.currentSession.endTime = Date.now();
            this.currentSession.frameCount = this.frameCount;
            // Persist session
            if (this.storage) {
                try {
                    await this.storage.saveSession(this.currentSession);
                }
                catch (err) {
                    logger.error(`[OpenSpaceRecorder] failed to save session: ${err.message}`);
                }
            }
        }
        const savedSession = this.currentSession;
        this.state = 'idle';
        this.currentSession = null;
        this.publishEvent('openspace:recording_stopped', {
            session: savedSession,
            timestamp: Date.now(),
        });
        logger.info('[OpenSpaceRecorder] recording stopped');
        return savedSession;
    }
    /**
     * Pause recording.
     */
    async pauseRecording() {
        if (this.state !== 'recording') {
            throw new Error(`Cannot pause: current state is "${this.state}"`);
        }
        if (this.bridge?.isConnected) {
            await this.bridge.sendScript({
                script: 'openspace.setPropertyValue("FrameExport.Pause", true)',
                language: 'lua',
                timeout: 5000,
            });
        }
        this.state = 'paused';
        this.publishEvent('openspace:recording_paused', {
            session: this.currentSession,
            timestamp: Date.now(),
        });
        logger.info('[OpenSpaceRecorder] recording paused');
    }
    /**
     * Resume paused recording.
     */
    async resumeRecording() {
        if (this.state !== 'paused') {
            throw new Error(`Cannot resume: current state is "${this.state}"`);
        }
        if (this.bridge?.isConnected) {
            await this.bridge.sendScript({
                script: 'openspace.setPropertyValue("FrameExport.Pause", false)',
                language: 'lua',
                timeout: 5000,
            });
        }
        this.state = 'recording';
        this.publishEvent('openspace:recording_started', {
            session: this.currentSession,
            timestamp: Date.now(),
        });
        logger.info('[OpenSpaceRecorder] recording resumed');
    }
    /**
     * List all saved recording sessions.
     */
    async getSessions() {
        if (!this.storage)
            return [];
        return this.storage.listSessions();
    }
    /**
     * Get session by ID.
     */
    async getSession(id) {
        if (!this.storage)
            return null;
        return this.storage.loadSession(id);
    }
    /**
     * Handle abnormal OpenSpace exit: mark current session as interrupted.
     */
    async handleProcessExit() {
        if (this.state === 'recording' || this.state === 'paused') {
            if (this.currentSession) {
                this.currentSession.endTime = Date.now();
                this.currentSession.frameCount = this.frameCount;
                if (this.storage) {
                    try {
                        await this.storage.saveSession(this.currentSession);
                    }
                    catch (err) {
                        logger.error(`[OpenSpaceRecorder] failed to save interrupted session: ${err.message}`);
                    }
                }
            }
            this.state = 'idle';
            this.publishEvent('openspace:recording_stopped', {
                session: this.currentSession,
                interrupted: true,
                timestamp: Date.now(),
            });
        }
    }
    setBridge(bridge) {
        this.bridge = bridge;
    }
    setStorage(storage) {
        this.storage = storage;
    }
    setDiskChecker(checker) {
        this.diskChecker = checker;
    }
    dispose() {
        if (this.diskMonitorInterval) {
            clearInterval(this.diskMonitorInterval);
            this.diskMonitorInterval = null;
        }
        if (this.playbackTimer) {
            clearTimeout(this.playbackTimer);
            this.playbackTimer = null;
        }
        this.state = 'idle';
        this.playback.playing = false;
    }
    publishEvent(topic, data) {
        if (this.eventBus) {
            this.eventBus.publish(topic, data, 'openspace-recorder');
        }
    }
}
//# sourceMappingURL=recorder.js.map