/**
 * 系统电源控制 IPC — 关机/重启/休眠/锁屏
 *
 * 跨平台实现，所有操作受 desktopControlEnabled 权限保护。
 */

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const execFileAsync = promisify(execFile);

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

const PERMISSION_DENIED = {
  success: false as const,
  error: '桌面控制权限未开启，请在 设置→高级→鼠标键盘操控权限 中开启',
};

// ── 跨平台命令映射 ──

const POWER_COMMANDS: Record<string, Record<string, { bin: string; args: string[] }>> = {
  shutdown: {
    win32:  { bin: 'shutdown', args: ['/s', '/t', '5'] },
    darwin: { bin: 'osascript', args: ['-e', 'tell app "System Events" to shut down'] },
    linux:  { bin: 'systemctl', args: ['poweroff'] },
  },
  restart: {
    win32:  { bin: 'shutdown', args: ['/r', '/t', '5'] },
    darwin: { bin: 'osascript', args: ['-e', 'tell app "System Events" to restart'] },
    linux:  { bin: 'systemctl', args: ['reboot'] },
  },
  sleep: {
    win32:  { bin: 'rundll32', args: ['powrprof.dll,SetSuspendState', '0', '1', '0'] },
    darwin: { bin: 'pmset', args: ['sleepnow'] },
    linux:  { bin: 'systemctl', args: ['suspend'] },
  },
  lock: {
    win32:  { bin: 'rundll32', args: ['user32.dll,LockWorkStation'] },
    darwin: { bin: 'pmset', args: ['displaysleepnow'] },
    linux:  { bin: 'loginctl', args: ['lock-session'] },
  },
};

export function registerSystemPowerIpc(): void {
  // shutdown
  ipcMain.handle('system-power:shutdown', async () => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    try {
      const cmd = POWER_COMMANDS.shutdown[process.platform] || POWER_COMMANDS.shutdown.linux;
      await execFileAsync(cmd.bin, cmd.args);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '关机命令执行失败' };
    }
  });

  // restart
  ipcMain.handle('system-power:restart', async () => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    try {
      const cmd = POWER_COMMANDS.restart[process.platform] || POWER_COMMANDS.restart.linux;
      await execFileAsync(cmd.bin, cmd.args);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '重启命令执行失败' };
    }
  });

  // sleep
  ipcMain.handle('system-power:sleep', async () => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    try {
      const cmd = POWER_COMMANDS.sleep[process.platform] || POWER_COMMANDS.sleep.linux;
      await execFileAsync(cmd.bin, cmd.args);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '休眠命令执行失败' };
    }
  });

  // lock
  ipcMain.handle('system-power:lock', async () => {
    if (!(await checkDesktopControlEnabled())) return PERMISSION_DENIED;
    try {
      const cmd = POWER_COMMANDS.lock[process.platform] || POWER_COMMANDS.lock.linux;
      await execFileAsync(cmd.bin, cmd.args);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || '锁屏命令执行失败' };
    }
  });

  console.log('[SystemPower] 4 IPC handlers registered');
}
