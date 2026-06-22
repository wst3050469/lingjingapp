/**
 * 桌面控制 IPC — 键盘/鼠标模拟操作
 * 
 * 基于 robotjs 原生模块实现跨平台输入模拟：
 *   Windows: SendInput API
 *   macOS:   CGEvent API  
 *   Linux:   XTest extension
 * 
 * 所有操作受 desktopControlEnabled 权限开关保护。
 */

import { ipcMain } from 'electron';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

// 延迟加载 robotjs 原生模块 — 避免启动时因 .node 缺失/版本不匹配导致应用崩溃
let _robot: any = null;
let _robotLoadError: string | null = null;

function getRobot(): any {
  if (_robot) return _robot;
  if (_robotLoadError) {
    throw new Error(`robotjs 原生模块不可用: ${_robotLoadError}`);
  }
  try {
    _robot = require('robotjs');
    return _robot;
  } catch (err: any) {
    _robotLoadError = err?.message || String(err);
    throw new Error(`robotjs 原生模块加载失败: ${_robotLoadError}`);
  }
}

// ── 权限检查（复用 app-control-ipc 的逻辑） ──

async function checkDesktopControlEnabled(): Promise<boolean> {
  try {
    const cfgPath = join(homedir(), '.lingjing', 'config.json');
    const raw = await readFile(cfgPath, 'utf8');
    const cfg = JSON.parse(raw);
    const adv = cfg.advanced as Record<string, unknown> | undefined;
    return !!(adv?.desktopControlEnabled);
  } catch {
    return false;
  }
}

// ── RobotJS 错误包装 ──

function wrapRobot<T>(fn: () => T): { success: true; data: T } | { success: false; error: string } {
  try {
    return { success: true, data: fn() };
  } catch (err: any) {
    const msg = err?.message || String(err);
    // 常见错误友好提示
    if (msg.includes('XTest') || msg.includes('DISPLAY')) {
      return { success: false, error: '无法连接显示服务器。Linux 需要 DISPLAY 环境变量和 XTest 扩展。' };
    }
    if (msg.includes('cannot open display') || msg.includes('GTK')) {
      return { success: false, error: '无法打开显示器，请确认在图形界面环境下运行。' };
    }
    return { success: false, error: msg || '操作执行失败' };
  }
}

// ── 帮助函数：截屏转 base64 ──

function bitmapToBase64(bitmap: { width: number; height: number; image: Buffer; bytesPerPixel: number }): string {
  const { width, height, image, bytesPerPixel } = bitmap;
  // 创建 PNG 格式（简化实现：使用 BMP 头 + 像素数据，然后包装为 base64）
  // 更优雅的方式是直接创建 BMP buffer
  const dataSize = width * height * bytesPerPixel;
  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const fileSize = fileHeaderSize + infoHeaderSize + dataSize;

  const buffer = Buffer.alloc(fileSize);

  // BMP File Header
  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);  // reserved
  buffer.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10); // pixel data offset

  // DIB Header (BITMAPINFOHEADER)
  buffer.writeUInt32LE(infoHeaderSize, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(-height, 22); // negative = top-down (BGRA)
  buffer.writeUInt16LE(1, 26);  // planes
  buffer.writeUInt32LE(bytesPerPixel * 8, 28); // bits per pixel
  buffer.writeUInt32LE(0, 30);  // BI_RGB = no compression
  buffer.writeUInt32LE(dataSize, 34);
  buffer.writeUInt32LE(0, 38);  // horizontal resolution
  buffer.writeUInt32LE(0, 42);  // vertical resolution
  buffer.writeUInt32LE(0, 46);  // colors in palette
  buffer.writeUInt32LE(0, 50);  // important colors

  // Pixel data (robotjs 返回的 image 是 BGRA 顺序的 Buffer)
  if (Buffer.isBuffer(image)) {
    image.copy(buffer, fileHeaderSize + infoHeaderSize);
  } else if (typeof image === 'object' && image !== null) {
    // robotjs Bitmap.image 在某些版本是 Uint8Array-like
    const imgBuf = Buffer.from(image as any);
    imgBuf.copy(buffer, fileHeaderSize + infoHeaderSize);
  }

  return `data:image/bmp;base64,${buffer.toString('base64')}`;
}

// ── 导出注册函数 ──

export function registerDesktopControlIpc(): void {
  const PERMISSION_DENIED = {
    success: false as const,
    error: '桌面控制权限未开启，请在 设置→高级→鼠标键盘操控权限 中开启',
  };

  // ──── 鼠标操作 ────

  ipcMain.handle('desktop-control:mouse-position', async () => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    return wrapRobot(() => getRobot().getMousePos());
  });

  ipcMain.handle('desktop-control:mouse-move', async (_event, { x, y }: { x: number; y: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || y < 0) {
      return { success: false, error: '坐标参数无效' };
    }
    return wrapRobot(() => {
      getRobot().moveMouse(x, y);
      return { x, y };
    });
  });

  ipcMain.handle('desktop-control:mouse-move-smooth', async (_event, { x, y, speed }: { x: number; y: number; speed?: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || y < 0) {
      return { success: false, error: '坐标参数无效' };
    }
    return wrapRobot(() => {
      if (speed !== undefined) {
        getRobot().moveMouseSmooth(x, y, speed);
      } else {
        getRobot().moveMouseSmooth(x, y);
      }
      return { x, y };
    });
  });

  ipcMain.handle('desktop-control:mouse-click', async (_event, { button, double }: { button?: string; double?: boolean }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    const btn = (button === 'left' || button === 'right' || button === 'middle') ? button : 'left';
    const isDouble = !!double;
    return wrapRobot(() => {
      getRobot().mouseClick(btn, isDouble);
      return { button: btn, double: isDouble };
    });
  });

  ipcMain.handle('desktop-control:mouse-toggle', async (_event, { down, button }: { down?: string; button?: string }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    const direction = (down === 'down' || down === 'up') ? down : 'down';
    const btn = (button === 'left' || button === 'right' || button === 'middle') ? button : 'left';
    return wrapRobot(() => {
      getRobot().mouseToggle(direction, btn);
      return { direction, button: btn };
    });
  });

  ipcMain.handle('desktop-control:mouse-drag', async (_event, { x, y }: { x: number; y: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || y < 0) {
      return { success: false, error: '坐标参数无效' };
    }
    return wrapRobot(() => {
      getRobot().dragMouse(x, y);
      return { x, y };
    });
  });

  ipcMain.handle('desktop-control:mouse-scroll', async (_event, { x, y }: { x: number; y: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return { success: false, error: '滚动方向参数无效' };
    }
    return wrapRobot(() => {
      getRobot().scrollMouse(x, y);
      return { x, y };
    });
  });

  // ──── 键盘操作 ────

  ipcMain.handle('desktop-control:keyboard-type', async (_event, { text }: { text: string }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof text !== 'string' || !text) {
      return { success: false, error: '输入文本不能为空' };
    }
    return wrapRobot(() => {
      getRobot().typeString(text);
      return { length: text.length };
    });
  });

  ipcMain.handle('desktop-control:keyboard-type-delayed', async (_event, { text, cpm }: { text: string; cpm: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof text !== 'string' || !text) {
      return { success: false, error: '输入文本不能为空' };
    }
    return wrapRobot(() => {
      getRobot().typeStringDelayed(text, cpm || 60);
      return { length: text.length, cpm };
    });
  });

  ipcMain.handle('desktop-control:keyboard-tap', async (_event, { key, modifiers }: { key: string; modifiers?: string | string[] }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof key !== 'string' || !key) {
      return { success: false, error: '按键名不能为空' };
    }
    return wrapRobot(() => {
      if (modifiers) {
        getRobot().keyTap(key, modifiers);
      } else {
        getRobot().keyTap(key);
      }
      return { key, modifiers };
    });
  });

  ipcMain.handle('desktop-control:keyboard-toggle', async (_event, { key, down, modifiers }: { key: string; down: string; modifiers?: string | string[] }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof key !== 'string' || !key) {
      return { success: false, error: '按键名不能为空' };
    }
    const direction = (down === 'down' || down === 'up') ? down : 'down';
    return wrapRobot(() => {
      if (modifiers) {
        getRobot().keyToggle(key, direction, modifiers);
      } else {
        getRobot().keyToggle(key, direction);
      }
      return { key, direction, modifiers };
    });
  });

  // ──── 屏幕操作 ────

  ipcMain.handle('desktop-control:screen-size', async () => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    return wrapRobot(() => getRobot().getScreenSize());
  });

  ipcMain.handle('desktop-control:screen-capture', async (_event, opts?: { x?: number; y?: number; width?: number; height?: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    const result = wrapRobot(() => {
      const bitmap = getRobot().screen.capture(
        opts?.x,
        opts?.y,
        opts?.width,
        opts?.height,
      );
      return bitmap;
    });
    if (!result.success) return result;
    try {
      const base64 = bitmapToBase64(result.data);
      return {
        success: true as const,
        data: {
          width: result.data.width,
          height: result.data.height,
          bytesPerPixel: result.data.bytesPerPixel,
          base64,
        },
      };
    } catch (err: any) {
      return { success: false, error: `截屏编码失败: ${err.message}` };
    }
  });

  ipcMain.handle('desktop-control:pixel-color', async (_event, { x, y }: { x: number; y: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    return wrapRobot(() => getRobot().getPixelColor(x, y));
  });

  // ──── 延迟设置 ────

  ipcMain.handle('desktop-control:set-mouse-delay', async (_event, { delay }: { delay: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    return wrapRobot(() => {
      getRobot().setMouseDelay(delay);
      return { delay };
    });
  });

  ipcMain.handle('desktop-control:set-keyboard-delay', async (_event, { delay }: { delay: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    return wrapRobot(() => {
      getRobot().setKeyboardDelay(delay);
      return { delay };
    });
  });

  console.log('[DesktopControl] 14 IPC handlers registered');
}
