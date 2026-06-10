import type { DisplayMode, WindowState } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus } from '../event-bus/types.js';
export interface IWindowManager {
    findWindow(title: string): Promise<{
        handle: number;
        title: string;
    } | null>;
    setParent(handle: number, parentHandle: number): Promise<void>;
    setPosition(handle: number, x: number, y: number, w: number, h: number): Promise<void>;
    setFullscreen(handle: number, fullscreen: boolean): Promise<void>;
    getDisplays(): Promise<Array<{
        id: number;
        bounds: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }>>;
    onWindowEvent(handle: number, callback: (event: string, data: unknown) => void): () => void;
}
export declare class OpenSpaceRenderer {
    private mode;
    private windowHandle;
    private embeddedParentHandle;
    private currentDisplayId;
    private currentWindowState;
    private windowManager;
    private bridge;
    private eventBus;
    private unregisterWindowEvents;
    constructor(windowManager?: IWindowManager, bridge?: OpenSpaceBridge, eventBus?: IEventBus);
    get currentMode(): DisplayMode;
    get windowState(): WindowState;
    /**
     * Embed OpenSpace window as a child of the given parent (Electron BrowserWindow).
     */
    embed(opts: {
        parentHandle?: number;
        wsPort?: number;
    }): Promise<void>;
    /**
     * Switch display mode.
     */
    setMode(mode: DisplayMode): Promise<void>;
    /**
     * Position the window on a specific display.
     */
    setDisplay(displayId: number): Promise<void>;
    /**
     * Register a state change callback.
     */
    onStateChange(callback: (mode: DisplayMode, state: WindowState) => void): () => void;
    setBridge(bridge: OpenSpaceBridge): void;
    setWindowManager(wm: IWindowManager): void;
    dispose(): void;
    private publishEvent;
}
//# sourceMappingURL=renderer.d.ts.map