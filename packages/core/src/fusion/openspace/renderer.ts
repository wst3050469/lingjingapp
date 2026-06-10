import type { DisplayMode, WindowState, ScriptLanguage } from './types.js';
import type { OpenSpaceBridge } from './bridge.js';
import type { IEventBus, EventTopic } from '../event-bus/types.js';
import { logger } from '../../utils/logger.js';

export interface IWindowManager {
  findWindow(title: string): Promise<{ handle: number; title: string } | null>;
  setParent(handle: number, parentHandle: number): Promise<void>;
  setPosition(handle: number, x: number, y: number, w: number, h: number): Promise<void>;
  setFullscreen(handle: number, fullscreen: boolean): Promise<void>;
  getDisplays(): Promise<Array<{ id: number; bounds: { x: number; y: number; width: number; height: number } }>>;
  onWindowEvent(handle: number, callback: (event: string, data: unknown) => void): () => void;
}

export class OpenSpaceRenderer {
  private mode: DisplayMode = 'standalone';
  private windowHandle: number | null = null;
  private embeddedParentHandle: number | null = null;
  private currentDisplayId = 0;
  private currentWindowState: WindowState = { x: 0, y: 0, width: 1920, height: 1080, focused: false };
  private windowManager: IWindowManager | null;
  private bridge: OpenSpaceBridge | null;
  private eventBus: IEventBus | null;
  private unregisterWindowEvents: (() => void) | null = null;

  constructor(windowManager?: IWindowManager, bridge?: OpenSpaceBridge, eventBus?: IEventBus) {
    this.windowManager = windowManager ?? null;
    this.bridge = bridge ?? null;
    this.eventBus = eventBus ?? null;
  }

  get currentMode(): DisplayMode {
    return this.mode;
  }

  get windowState(): WindowState {
    return { ...this.currentWindowState };
  }

  /**
   * Embed OpenSpace window as a child of the given parent (Electron BrowserWindow).
   */
  async embed(opts: { parentHandle?: number; wsPort?: number }): Promise<void> {
    if (!this.windowManager) {
      throw new Error('WindowManager not available (non-Electron environment)');
    }

    // Find OpenSpace window by title
    const win = await this.windowManager.findWindow('OpenSpace');
    if (!win) {
      this.mode = 'standalone';
      this.publishEvent('openspace:embed_fallback' as EventTopic, {
        reason: 'window_not_found',
        timestamp: Date.now(),
      });
      logger.warn('[OpenSpaceRenderer] OpenSpace window not found, falling back to standalone');
      return;
    }

    this.windowHandle = win.handle;

    if (opts.parentHandle) {
      this.embeddedParentHandle = opts.parentHandle;
      try {
        await this.windowManager.setParent(win.handle, opts.parentHandle);
        this.mode = 'embedded';
        logger.info('[OpenSpaceRenderer] embedded OpenSpace window');
      } catch (err) {
        this.mode = 'standalone';
        this.publishEvent('openspace:embed_fallback' as EventTopic, {
          reason: `setParent failed: ${(err as Error).message}`,
          timestamp: Date.now(),
        });
        logger.warn(`[OpenSpaceRenderer] embed failed: ${(err as Error).message}`);
        return;
      }
    }

    // Register window event listeners
    this.unregisterWindowEvents = this.windowManager.onWindowEvent(
      win.handle,
      (_event, data) => {
        this.currentWindowState = data as WindowState;
        this.publishEvent('openspace:window_changed' as EventTopic, {
          ...this.currentWindowState,
          timestamp: Date.now(),
        });
      },
    );

    // Set initial position
    await this.windowManager.setPosition(
      win.handle,
      this.currentWindowState.x,
      this.currentWindowState.y,
      this.currentWindowState.width,
      this.currentWindowState.height,
    );
  }

  /**
   * Switch display mode.
   */
  async setMode(mode: DisplayMode): Promise<void> {
    this.mode = mode;

    switch (mode) {
      case 'fullscreen': {
        if (this.bridge?.isConnected) {
          await this.bridge.sendScript({
            script: 'openspace.setPropertyValue("RenderEngine.Window.Fullscreen", true)',
            language: 'lua' as ScriptLanguage,
            timeout: 5000,
          });
        } else if (this.windowHandle && this.windowManager) {
          await this.windowManager.setFullscreen(this.windowHandle, true);
        }
        this.currentWindowState.focused = true;
        break;
      }
      case 'embedded': {
        if (this.windowHandle && this.embeddedParentHandle && this.windowManager) {
          await this.windowManager.setParent(this.windowHandle, this.embeddedParentHandle);
        }
        break;
      }
      case 'standalone': {
        if (this.bridge?.isConnected) {
          await this.bridge.sendScript({
            script: 'openspace.setPropertyValue("RenderEngine.Window.Fullscreen", false)',
            language: 'lua' as ScriptLanguage,
            timeout: 5000,
          });
        }
        break;
      }
    }

    this.publishEvent('openspace:window_changed' as EventTopic, {
      mode,
      ...this.currentWindowState,
      timestamp: Date.now(),
    });
    logger.info(`[OpenSpaceRenderer] mode changed to: ${mode}`);
  }

  /**
   * Position the window on a specific display.
   */
  async setDisplay(displayId: number): Promise<void> {
    if (!this.windowManager) return;

    const displays = await this.windowManager.getDisplays();
    const target = displays.find((d) => d.id === displayId);
    if (!target) {
      throw new Error(`Display ${displayId} not found. Available: ${displays.map((d) => d.id).join(',')}`);
    }

    this.currentDisplayId = displayId;

    if (this.windowHandle) {
      await this.windowManager.setPosition(
        this.windowHandle,
        target.bounds.x,
        target.bounds.y,
        this.currentWindowState.width,
        this.currentWindowState.height,
      );
      this.currentWindowState.x = target.bounds.x;
      this.currentWindowState.y = target.bounds.y;
    }

    logger.info(`[OpenSpaceRenderer] window moved to display ${displayId}`);
  }

  /**
   * Register a state change callback.
   */
  onStateChange(callback: (mode: DisplayMode, state: WindowState) => void): () => void {
    // Simple callback pattern — for advanced usage, use EventBus
    let active = true;
    const handler = (mode: DisplayMode, state: WindowState) => {
      if (active) callback(mode, state);
    };
    return () => { active = false; };
  }

  setBridge(bridge: OpenSpaceBridge): void {
    this.bridge = bridge;
  }

  setWindowManager(wm: IWindowManager): void {
    this.windowManager = wm;
  }

  dispose(): void {
    if (this.unregisterWindowEvents) {
      this.unregisterWindowEvents();
      this.unregisterWindowEvents = null;
    }
    this.windowHandle = null;
    this.mode = 'standalone';
  }

  private publishEvent(topic: EventTopic, data: Record<string, unknown>): void {
    if (this.eventBus) {
      this.eventBus.publish(topic, data, 'openspace-renderer');
    }
  }
}
