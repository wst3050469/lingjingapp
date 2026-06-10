import { app, screen } from 'electron';

const DEFAULT_WIDTH = 1400;
const DEFAULT_HEIGHT = 900;
const DEFAULT_MIN_WIDTH = 800;
const DEFAULT_MIN_HEIGHT = 600;

interface WindowBounds {
  width: number;
  height: number;
  x: number;
  y: number;
}

export function validateWindowBounds(savedBounds?: Partial<WindowBounds>): WindowBounds {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const { x: screenX, y: screenY } = primaryDisplay.workArea;

  if (!savedBounds || !savedBounds.width || !savedBounds.height) {
    return {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      x: screenX + Math.floor((screenWidth - DEFAULT_WIDTH) / 2),
      y: screenY + Math.floor((screenHeight - DEFAULT_HEIGHT) / 2),
    };
  }

  let { width, height, x, y } = savedBounds as WindowBounds;

  // v1.72.11: Guard against NaN/Infinity in saved bounds (corrupted config)
  if (!Number.isFinite(width) || width <= 0 || width < DEFAULT_MIN_WIDTH) width = DEFAULT_WIDTH;
  if (!Number.isFinite(height) || height <= 0 || height < DEFAULT_MIN_HEIGHT) height = DEFAULT_HEIGHT;
  if (!Number.isFinite(x)) x = Math.floor((screenWidth - width) / 2);
  if (!Number.isFinite(y)) y = Math.floor((screenHeight - height) / 2);

  const windowCenterX = x + width / 2;
  const windowCenterY = y + height / 2;
  const displays = screen.getAllDisplays();
  const isOnAnyDisplay = displays.some(d => {
    const { x: dx, y: dy, width: dw, height: dh } = d.workArea;
    return windowCenterX >= dx && windowCenterX <= dx + dw &&
           windowCenterY >= dy && windowCenterY <= dy + dh;
  });

  if (!isOnAnyDisplay) {
    console.warn('[Window] Window position on disconnected display, moving to primary');
    x = screenX + Math.floor((screenWidth - width) / 2);
    y = screenY + Math.floor((screenHeight - height) / 2);
  }

  const nearestDisplay = screen.getDisplayNearestPoint({ x: Math.round(windowCenterX), y: Math.round(windowCenterY) });
  const { x: ndX, y: ndY, width: ndW, height: ndH } = nearestDisplay.workArea;
  const visibleWidth = Math.max(0, Math.min(x + width, ndX + ndW) - Math.max(x, ndX));
  const visibleHeight = Math.max(0, Math.min(y + height, ndY + ndH) - Math.max(y, ndY));
  const visibleRatio = (visibleWidth * visibleHeight) / (width * height);

  if (visibleRatio < 0.5) {
    x = ndX + Math.floor((ndW - width) / 2);
    y = ndY + Math.floor((ndH - height) / 2);
  }

  return { width, height, x, y };
}

let gpuDegraded = false;
let windowCreateFailCount = 0;
const MAX_CREATE_FAIL_COUNT = 3;

export function recordWindowCreateFailure(): boolean {
  windowCreateFailCount++;
  console.warn(`[Window] Create failure count: ${windowCreateFailCount}/${MAX_CREATE_FAIL_COUNT}`);

  // v1.72.11: REMOVED app.commandLine.appendSwitch('disable-gpu').
  // v1.72.10 fixed the "no window" bug by removing --disable-gpu from main.ts,
  // but this fallback code re-enabled it after 3 consecutive failures — directly
  // contradicting the fix. On machines where window creation transiently fails
  // (e.g., GPU driver hiccup, config corruption), this would inject --disable-gpu
  // and cause the exact same "no window" symptom (BrowserWindow exists but draws
  // nothing because the GPU process is killed).
  //
  // Instead, we just mark degraded mode for diagnostic purposes. The degraded
  // BrowserWindow creation path in createWindow() already falls back to default
  // params (1400x900, centered) which is sufficient for recovery.
  if (windowCreateFailCount >= MAX_CREATE_FAIL_COUNT && !gpuDegraded) {
    console.warn('[Window] 3 consecutive window creation failures — entering degraded mode (GPU NOT disabled)');
    gpuDegraded = true;
    return true;
  }
  return false;
}

export function resetWindowCreateFailCount(): void {
  windowCreateFailCount = 0;
}

export function isGpuDegraded(): boolean {
  return gpuDegraded;
}

export { DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_MIN_WIDTH, DEFAULT_MIN_HEIGHT };
export type { WindowBounds };
