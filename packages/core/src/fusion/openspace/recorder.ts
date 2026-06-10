import type { RecordingConfig, RecordingState, RecordingSession, ScriptLanguage } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus, EventTopic } from '../event-bus/types.js';
import { logger } from '../../utils/logger.js';

export interface IRecorderStorage {
  saveSession(session: RecordingSession): Promise<void>;
  loadSession(id: string): Promise<RecordingSession | null>;
  listSessions(): Promise<RecordingSession[]>;
  deleteSession(id: string): Promise<void>;
}

export interface IDiskSpace {
  getFreeSpace(path: string): Promise<number>; // bytes
}

interface PlaybackState {
  playing: boolean;
  currentFrame: number;
  totalFrames: number;
  speed: number;
  sessionId: string | null;
  timeline: Array<{ time: number; script: string; language: ScriptLanguage }>;
}

const DEFAULT_RECORDING_CONFIG: RecordingConfig = {
  fps: 30,
  resolution: [1920, 1080],
  outputDir: '',
  format: 'png',
};

const MIN_DISK_SPACE_BYTES = 500 * 1024 * 1024; // 500MB minimum

export class OpenSpaceRecorder {
  private config: RecordingConfig;
  private state: RecordingState = 'idle';
  private bridge: OpenSpaceBridge | null;
  private storage: IRecorderStorage | null;
  private diskChecker: IDiskSpace | null;
  private eventBus: IEventBus | null;
  private currentSession: RecordingSession | null = null;
  private startTimestamp = 0;
  private frameCount = 0;
  private diskMonitorInterval: ReturnType<typeof setInterval> | null = null;
  private playback: PlaybackState = {
    playing: false,
    currentFrame: 0,
    totalFrames: 0,
    speed: 1,
    sessionId: null,
    timeline: [],
  };
  private playbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    config?: Partial<RecordingConfig>,
    bridge?: OpenSpaceBridge,
    storage?: IRecorderStorage,
    diskChecker?: IDiskSpace,
    eventBus?: IEventBus,
  ) {
    this.config = { ...DEFAULT_RECORDING_CONFIG, ...config };
    this.bridge = bridge ?? null;
    this.storage = storage ?? null;
    this.diskChecker = diskChecker ?? null;
    this.eventBus = eventBus ?? null;
  }

  get currentState(): RecordingState {
    return this.state;
  }

  /**
   * Start recording: configure frame export and begin capturing.
   */
  async startRecording(config?: Partial<RecordingConfig>): Promise<void> {
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
        throw new Error(
          `Insufficient disk space: ${Math.round(freeSpace / 1024 / 1024)}MB available, ${MIN_DISK_SPACE_BYTES / 1024 / 1024}MB required`,
        );
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
      language: 'lua' as ScriptLanguage,
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
          const freeSpace = await this.diskChecker!.getFreeSpace(this.config.outputDir);
          if (freeSpace < MIN_DISK_SPACE_BYTES) {
            logger.warn('[OpenSpaceRecorder] Low disk space, auto-stopping recording');
            await this.stopRecording();
          }
        } catch {
          // ignore monitor errors
        }
      }, 10000);
    }

    this.publishEvent('openspace:recording_started' as EventTopic, {
      session: this.currentSession,
      timestamp: Date.now(),
    });

    logger.info('[OpenSpaceRecorder] recording started');
  }

  /**
   * Stop recording and persist session metadata.
   */
  async stopRecording(): Promise<RecordingSession | null> {
    if (this.state !== 'recording' && this.state !== 'paused') {
      throw new Error(`Cannot stop recording: current state is "${this.state}"`);
    }

    // Disable frame export
    if (this.bridge?.isConnected) {
      await this.bridge.sendScript({
        script: 'openspace.setPropertyValue("FrameExport.Enabled", false)',
        language: 'lua' as ScriptLanguage,
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
        } catch (err) {
          logger.error(`[OpenSpaceRecorder] failed to save session: ${(err as Error).message}`);
        }
      }
    }

    const savedSession = this.currentSession;
    this.state = 'idle';
    this.currentSession = null;

    this.publishEvent('openspace:recording_stopped' as EventTopic, {
      session: savedSession,
      timestamp: Date.now(),
    });

    logger.info('[OpenSpaceRecorder] recording stopped');
    return savedSession;
  }

  /**
   * Pause recording.
   */
  async pauseRecording(): Promise<void> {
    if (this.state !== 'recording') {
      throw new Error(`Cannot pause: current state is "${this.state}"`);
    }

    if (this.bridge?.isConnected) {
      await this.bridge.sendScript({
        script: 'openspace.setPropertyValue("FrameExport.Pause", true)',
        language: 'lua' as ScriptLanguage,
        timeout: 5000,
      });
    }

    this.state = 'paused';
    this.publishEvent('openspace:recording_paused' as EventTopic, {
      session: this.currentSession,
      timestamp: Date.now(),
    });

    logger.info('[OpenSpaceRecorder] recording paused');
  }

  /**
   * Resume paused recording.
   */
  async resumeRecording(): Promise<void> {
    if (this.state !== 'paused') {
      throw new Error(`Cannot resume: current state is "${this.state}"`);
    }

    if (this.bridge?.isConnected) {
      await this.bridge.sendScript({
        script: 'openspace.setPropertyValue("FrameExport.Pause", false)',
        language: 'lua' as ScriptLanguage,
        timeout: 5000,
      });
    }

    this.state = 'recording';
    this.publishEvent('openspace:recording_started' as EventTopic, {
      session: this.currentSession,
      timestamp: Date.now(),
    });

    logger.info('[OpenSpaceRecorder] recording resumed');
  }

  /**
   * List all saved recording sessions.
   */
  async getSessions(): Promise<RecordingSession[]> {
    if (!this.storage) return [];
    return this.storage.listSessions();
  }

  /**
   * Get session by ID.
   */
  async getSession(id: string): Promise<RecordingSession | null> {
    if (!this.storage) return null;
    return this.storage.loadSession(id);
  }

  /**
   * Handle abnormal OpenSpace exit: mark current session as interrupted.
   */
  async handleProcessExit(): Promise<void> {
    if (this.state === 'recording' || this.state === 'paused') {
      if (this.currentSession) {
        this.currentSession.endTime = Date.now();
        this.currentSession.frameCount = this.frameCount;

        if (this.storage) {
          try {
            await this.storage.saveSession(this.currentSession);
          } catch (err) {
            logger.error(`[OpenSpaceRecorder] failed to save interrupted session: ${(err as Error).message}`);
          }
        }
      }

      this.state = 'idle';
      this.publishEvent('openspace:recording_stopped' as EventTopic, {
        session: this.currentSession,
        interrupted: true,
        timestamp: Date.now(),
      });
    }
  }

  setBridge(bridge: OpenSpaceBridge): void {
    this.bridge = bridge;
  }

  setStorage(storage: IRecorderStorage): void {
    this.storage = storage;
  }

  setDiskChecker(checker: IDiskSpace): void {
    this.diskChecker = checker;
  }

  dispose(): void {
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

  private publishEvent(topic: EventTopic, data: Record<string, unknown>): void {
    if (this.eventBus) {
      this.eventBus.publish(topic, data, 'openspace-recorder');
    }
  }
}
