import type { RecordingConfig, RecordingState, RecordingSession } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus } from '../event-bus/types.js';
export interface IRecorderStorage {
    saveSession(session: RecordingSession): Promise<void>;
    loadSession(id: string): Promise<RecordingSession | null>;
    listSessions(): Promise<RecordingSession[]>;
    deleteSession(id: string): Promise<void>;
}
export interface IDiskSpace {
    getFreeSpace(path: string): Promise<number>;
}
export declare class OpenSpaceRecorder {
    private config;
    private state;
    private bridge;
    private storage;
    private diskChecker;
    private eventBus;
    private currentSession;
    private startTimestamp;
    private frameCount;
    private diskMonitorInterval;
    private playback;
    private playbackTimer;
    constructor(config?: Partial<RecordingConfig>, bridge?: OpenSpaceBridge, storage?: IRecorderStorage, diskChecker?: IDiskSpace, eventBus?: IEventBus);
    get currentState(): RecordingState;
    /**
     * Start recording: configure frame export and begin capturing.
     */
    startRecording(config?: Partial<RecordingConfig>): Promise<void>;
    /**
     * Stop recording and persist session metadata.
     */
    stopRecording(): Promise<RecordingSession | null>;
    /**
     * Pause recording.
     */
    pauseRecording(): Promise<void>;
    /**
     * Resume paused recording.
     */
    resumeRecording(): Promise<void>;
    /**
     * List all saved recording sessions.
     */
    getSessions(): Promise<RecordingSession[]>;
    /**
     * Get session by ID.
     */
    getSession(id: string): Promise<RecordingSession | null>;
    /**
     * Handle abnormal OpenSpace exit: mark current session as interrupted.
     */
    handleProcessExit(): Promise<void>;
    setBridge(bridge: OpenSpaceBridge): void;
    setStorage(storage: IRecorderStorage): void;
    setDiskChecker(checker: IDiskSpace): void;
    dispose(): void;
    private publishEvent;
}
//# sourceMappingURL=recorder.d.ts.map