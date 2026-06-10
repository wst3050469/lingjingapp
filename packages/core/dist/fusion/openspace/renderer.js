import { logger } from '../../utils/logger.js';
export class OpenSpaceRenderer {
    mode = 'standalone';
    windowHandle = null;
    embeddedParentHandle = null;
    currentDisplayId = 0;
    currentWindowState = { x: 0, y: 0, width: 1920, height: 1080, focused: false };
    windowManager;
    bridge;
    eventBus;
    unregisterWindowEvents = null;
    constructor(windowManager, bridge, eventBus) {
        this.windowManager = windowManager ?? null;
        this.bridge = bridge ?? null;
        this.eventBus = eventBus ?? null;
    }
    get currentMode() {
        return this.mode;
    }
    get windowState() {
        return { ...this.currentWindowState };
    }
    /**
     * Embed OpenSpace window as a child of the given parent (Electron BrowserWindow).
     */
    async embed(opts) {
        if (!this.windowManager) {
            throw new Error('WindowManager not available (non-Electron environment)');
        }
        // Find OpenSpace window by title
        const win = await this.windowManager.findWindow('OpenSpace');
        if (!win) {
            this.mode = 'standalone';
            this.publishEvent('openspace:embed_fallback', {
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
            }
            catch (err) {
                this.mode = 'standalone';
                this.publishEvent('openspace:embed_fallback', {
                    reason: `setParent failed: ${err.message}`,
                    timestamp: Date.now(),
                });
                logger.warn(`[OpenSpaceRenderer] embed failed: ${err.message}`);
                return;
            }
        }
        // Register window event listeners
        this.unregisterWindowEvents = this.windowManager.onWindowEvent(win.handle, (_event, data) => {
            this.currentWindowState = data;
            this.publishEvent('openspace:window_changed', {
                ...this.currentWindowState,
                timestamp: Date.now(),
            });
        });
        // Set initial position
        await this.windowManager.setPosition(win.handle, this.currentWindowState.x, this.currentWindowState.y, this.currentWindowState.width, this.currentWindowState.height);
    }
    /**
     * Switch display mode.
     */
    async setMode(mode) {
        this.mode = mode;
        switch (mode) {
            case 'fullscreen': {
                if (this.bridge?.isConnected) {
                    await this.bridge.sendScript({
                        script: 'openspace.setPropertyValue("RenderEngine.Window.Fullscreen", true)',
                        language: 'lua',
                        timeout: 5000,
                    });
                }
                else if (this.windowHandle && this.windowManager) {
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
                        language: 'lua',
                        timeout: 5000,
                    });
                }
                break;
            }
        }
        this.publishEvent('openspace:window_changed', {
            mode,
            ...this.currentWindowState,
            timestamp: Date.now(),
        });
        logger.info(`[OpenSpaceRenderer] mode changed to: ${mode}`);
    }
    /**
     * Position the window on a specific display.
     */
    async setDisplay(displayId) {
        if (!this.windowManager)
            return;
        const displays = await this.windowManager.getDisplays();
        const target = displays.find((d) => d.id === displayId);
        if (!target) {
            throw new Error(`Display ${displayId} not found. Available: ${displays.map((d) => d.id).join(',')}`);
        }
        this.currentDisplayId = displayId;
        if (this.windowHandle) {
            await this.windowManager.setPosition(this.windowHandle, target.bounds.x, target.bounds.y, this.currentWindowState.width, this.currentWindowState.height);
            this.currentWindowState.x = target.bounds.x;
            this.currentWindowState.y = target.bounds.y;
        }
        logger.info(`[OpenSpaceRenderer] window moved to display ${displayId}`);
    }
    /**
     * Register a state change callback.
     */
    onStateChange(callback) {
        // Simple callback pattern — for advanced usage, use EventBus
        let active = true;
        const handler = (mode, state) => {
            if (active)
                callback(mode, state);
        };
        return () => { active = false; };
    }
    setBridge(bridge) {
        this.bridge = bridge;
    }
    setWindowManager(wm) {
        this.windowManager = wm;
    }
    dispose() {
        if (this.unregisterWindowEvents) {
            this.unregisterWindowEvents();
            this.unregisterWindowEvents = null;
        }
        this.windowHandle = null;
        this.mode = 'standalone';
    }
    publishEvent(topic, data) {
        if (this.eventBus) {
            this.eventBus.publish(topic, data, 'openspace-renderer');
        }
    }
}
//# sourceMappingURL=renderer.js.map