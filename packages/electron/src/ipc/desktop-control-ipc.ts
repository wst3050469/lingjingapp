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

import { ipcMain, clipboard } from 'electron';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { deflateSync } from 'zlib';

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

// ── 中文输入支持 ──

function isAsciiOnly(text: string): boolean {
  return /^[\x00-\x7F]*$/.test(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeText(text: string, cpm?: number): Promise<{ length: number; method: 'robotjs' | 'clipboard' }> {
  // ASCII 文本直接走 robotjs，速度更快且不干扰剪贴板
  if (isAsciiOnly(text)) {
    if (cpm !== undefined && cpm > 0) {
      getRobot().typeStringDelayed(text, cpm);
    } else {
      getRobot().typeString(text);
    }
    return { length: text.length, method: 'robotjs' };
  }

  // 非 ASCII 文本走剪贴板粘贴
  // 1. 保存当前剪贴板内容
  const savedText = clipboard.readText();
  const savedImage = clipboard.readImage();
  const hasSavedImage = !savedImage.isEmpty();

  try {
    // 2. 写入目标文本
    clipboard.writeText(text);

    // 3. 模拟 Ctrl+V / Cmd+V
    const isMac = process.platform === 'darwin';
    const pasteKey = 'v';
    const pasteModifier = isMac ? 'command' : 'control';
    getRobot().keyTap(pasteKey, [pasteModifier]);

    // 4. 等待粘贴完成（根据文本长度动态计算，最少 150ms）
    const delay = Math.max(150, text.length * 2);
    await sleep(delay);
  } finally {
    // 5. 恢复剪贴板
    if (hasSavedImage) {
      clipboard.writeImage(savedImage);
    }
    clipboard.writeText(savedText);
  }

  return { length: text.length, method: 'clipboard' };
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

// ── 帮助函数：截屏转 base64 (BMP/PNG) ──

// CRC32 查表（PNG 规范）
const _crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  _crcTable[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = _crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeLen = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeLen, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeLen, data, crcVal]);
}

function bitmapToPng(bitmap: { width: number; height: number; image: Buffer; bytesPerPixel: number }): Buffer {
  const { width, height, image, bytesPerPixel } = bitmap;

  // 获取原始 BGRA 像素
  const src = Buffer.isBuffer(image) ? image : Buffer.from(image as any);
  const rowLen = width * 4; // RGBA 输出每行字节数

  // 构建过滤后的像素数据：每行前加 filter=0 (None), BGRA→RGBA
  const rawData = Buffer.alloc((rowLen + 1) * height);
  for (let y = 0; y < height; y++) {
    const dstOff = y * (rowLen + 1);
    rawData[dstOff] = 0; // filter byte
    for (let x = 0; x < width; x++) {
      const srcOff = y * width * bytesPerPixel + x * bytesPerPixel;
      const dstPixel = dstOff + 1 + x * 4;
      // BGRA → RGBA
      rawData[dstPixel]     = src[srcOff + 2]; // R (from B)
      rawData[dstPixel + 1] = src[srcOff + 1]; // G
      rawData[dstPixel + 2] = src[srcOff];     // B (from R)
      rawData[dstPixel + 3] = bytesPerPixel >= 4 ? src[srcOff + 3] : 255; // A
    }
  }

  // 压缩
  const compressed = deflateSync(rawData, { level: 6 });

  // PNG 签名
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT
  const idat = compressed;

  // IEND (空)
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', iend),
  ]);
}

type CaptureFormat = 'png' | 'bmp';

function bitmapToBase64(
  bitmap: { width: number; height: number; image: Buffer; bytesPerPixel: number },
  format: CaptureFormat = 'png',
): string {
  if (format === 'png') {
    const png = bitmapToPng(bitmap);
    return `data:image/png;base64,${png.toString('base64')}`;
  }

  // BMP (legacy)
  const { width, height, image, bytesPerPixel } = bitmap;
  const dataSize = width * height * bytesPerPixel;
  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const fileSize = fileHeaderSize + infoHeaderSize + dataSize;

  const buffer = Buffer.alloc(fileSize);
  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10);
  buffer.writeUInt32LE(infoHeaderSize, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(-height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt32LE(bytesPerPixel * 8, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(dataSize, 34);
  buffer.writeUInt32LE(0, 38);
  buffer.writeUInt32LE(0, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  if (Buffer.isBuffer(image)) {
    image.copy(buffer, fileHeaderSize + infoHeaderSize);
  } else if (typeof image === 'object' && image !== null) {
    Buffer.from(image as any).copy(buffer, fileHeaderSize + infoHeaderSize);
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
    try {
      const result = await typeText(text);
      return { success: true as const, data: result };
    } catch (err: any) {
      const msg = err?.message || String(err);
      return { success: false, error: msg || '文本输入失败' };
    }
  });

  ipcMain.handle('desktop-control:keyboard-type-delayed', async (_event, { text, cpm }: { text: string; cpm: number }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    if (typeof text !== 'string' || !text) {
      return { success: false, error: '输入文本不能为空' };
    }
    try {
      const result = await typeText(text, cpm || 60);
      return { success: true as const, data: result };
    } catch (err: any) {
      const msg = err?.message || String(err);
      return { success: false, error: msg || '文本输入失败' };
    }
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

  ipcMain.handle('desktop-control:screen-capture', async (_event, opts?: { x?: number; y?: number; width?: number; height?: number; format?: 'png' | 'bmp' }) => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    const format: CaptureFormat = opts?.format === 'bmp' ? 'bmp' : 'png';
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
      const base64 = bitmapToBase64(result.data, format);
      return {
        success: true as const,
        data: {
          width: result.data.width,
          height: result.data.height,
          bytesPerPixel: result.data.bytesPerPixel,
          format,
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
