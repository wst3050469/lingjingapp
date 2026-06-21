/**
 * 应用控制器服务 - 跨平台应用管理
 * 
 * 功能：
 * 1. 获取本机已安装应用列表
 * 2. 启动/关闭应用程序
 * 3. 窗口操作（聚焦、最小化、最大化、关闭）
 * 4. GUI自动化基础能力
 */

import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface AppInfo {
  name: string;
  path?: string;
  icon?: string;
  isRunning: boolean;
}

export interface WindowInfo {
  title: string;
  processId?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isFocused: boolean;
}

// 统一接口定义
export interface IAppController {
  getInstalledApps(): Promise<AppInfo[]>;
  getWindows(): Promise<WindowInfo[]>;
  launchApp(appName: string, args?: string[]): Promise<boolean>;
  closeApp(appName: string): Promise<boolean>;
  focusWindow(title: string): Promise<boolean>;
  screenshotActiveWindow(): Promise<string>; // base64
}

// ============ Windows 实现 ============
class WindowsAppController implements IAppController {
  async getInstalledApps(): Promise<AppInfo[]> {
    try {
      // 使用 PowerShell 读取注册表（比 wmic product 快得多）
      const script = `
        $apps = @()
        $paths = @(
          'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
          'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
          'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
        )
        foreach ($path in $paths) {
          if (Test-Path (Split-Path $path -Parent)) {
            $items = Get-ItemProperty $path -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -and $_.DisplayName -ne '' }
            foreach ($item in $items) {
              $apps += [PSCustomObject]@{
                Name = $item.DisplayName
                Path = $item.InstallLocation
                Version = $item.DisplayVersion
              }
            }
          }
        }
        $apps | Sort-Object Name -Unique | ConvertTo-Json -Compress
      `;
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
      
      if (!stdout.trim()) return [];
      
      let items: any[];
      try {
        const parsed = JSON.parse(stdout.trim());
        items = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
      
      return items.map((item: any) => ({
        name: item.Name || '',
        path: item.Path || undefined,
        isRunning: false,
      }));
    } catch (error) {
      console.error('[WindowsAppController] getInstalledApps error:', error);
      return [];
    }
  }

  async getWindows(): Promise<WindowInfo[]> {
    try {
      const script = `
        Get-Process | Where-Object { $_.MainWindowTitle -ne '' } | 
        Select-Object Id, MainWindowTitle, ProcessName |
        ConvertTo-Json -Compress
      `;
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
      
      if (!stdout.trim()) return [];
      
      let processes: any[];
      try {
        const parsed = JSON.parse(stdout.trim());
        // 处理单个结果（PowerShell ConvertTo-Json 返回对象，非数组）
        processes = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
      
      return processes.map((p: any) => ({
        title: p.MainWindowTitle || '',
        processId: p.Id,
        isFocused: false,
      }));
    } catch (error) {
      console.error('[WindowsAppController] getWindows error:', error);
      return [];
    }
  }

  async launchApp(appName: string, args?: string[]): Promise<boolean> {
    try {
      // Windows 使用 cmd /c start 来启动应用（支持 .exe/.lnk 等）
      const argStr = args && args.length > 0 ? args.join(' ') : '';
      await execFileAsync('cmd', ['/c', 'start', '', appName, ...(args || [])]);
      return true;
    } catch (error) {
      // 回退：直接 spawn
      try {
        const process = spawn(appName, args || [], {
          detached: true,
          stdio: 'ignore',
          shell: true,
        });
        process.unref();
        return process.pid !== undefined;
      } catch (err2) {
        console.error('[WindowsAppController] launchApp error:', error);
        return false;
      }
    }
  }

  async closeApp(appName: string): Promise<boolean> {
    try {
      // taskkill 支持 .exe 后缀和不带后缀
      await execFileAsync('taskkill', ['/F', '/IM', appName.includes('.') ? appName : `${appName}.exe`]);
      return true;
    } catch {
      // 尝试不带 .exe 后缀
      try {
        await execFileAsync('taskkill', ['/F', '/IM', appName]);
        return true;
      } catch (error) {
        console.error('[WindowsAppController] closeApp error:', error);
        return false;
      }
    }
  }

  async focusWindow(title: string): Promise<boolean> {
    try {
      // 通过 PowerShell 调用 Win32 SetForegroundWindow
      const script = `
        Add-Type @"
          using System;
          using System.Runtime.InteropServices;
          public class Win32 {
            [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
            [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
            [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
          }
"@
        $hwnd = [Win32]::FindWindow($null, '${title.replace(/'/g, "''")}')
        if ($hwnd -ne [IntPtr]::Zero) {
          [Win32]::ShowWindow($hwnd, 9)  # SW_RESTORE
          [Win32]::SetForegroundWindow($hwnd)
          Write-Output 'ok'
        } else {
          Write-Output 'notfound'
        }
      `;
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
      return stdout.trim() === 'ok';
    } catch (error) {
      console.error('[WindowsAppController] focusWindow error:', error);
      return false;
    }
  }

  async screenshotActiveWindow(): Promise<string> {
    console.warn('[WindowsAppController] screenshot not fully implemented');
    return '';
  }
}

// ============ macOS 实现 ============
class MacOSAppController implements IAppController {
  async getInstalledApps(): Promise<AppInfo[]> {
    try {
      // 使用 mdfind 搜索 .app bundle（修复通配符查询）
      const { stdout } = await execFileAsync('mdfind', [
        'kMDItemContentType == "com.apple.application-bundle"'
      ]);
      
      const apps: AppInfo[] = [];
      const seen = new Set<string>();
      stdout.split('\n').filter(Boolean).forEach(path => {
        const name = path.split('/').pop()?.replace('.app', '') || '';
        if (name && !seen.has(name)) {
          seen.add(name);
          apps.push({ name, path, isRunning: false });
        }
      });
      
      return apps;
    } catch (error) {
      console.error('[MacOSAppController] getInstalledApps error:', error);
      return [];
    }
  }

  async getWindows(): Promise<WindowInfo[]> {
    try {
      // 使用 osascript 获取所有窗口信息
      const script = `
        tell application "System Events"
          set winList to {}
          repeat with p in (every process whose background only is false)
            set procName to name of p
            try
              repeat with w in (every window of p whose name is not "")
                set end of winList to name of w & "|" & procName
              end repeat
            end try
          end repeat
          return winList
        end tell
      `;
      const { stdout } = await execFileAsync('osascript', ['-e', script]);
      
      // 解析 AppleScript 返回的逗号分隔列表
      const raw = stdout.trim();
      if (!raw) return [];
      
      // AppleScript list 返回格式: "item1, item2, item3"
      // 每个 item 是 "窗口标题|进程名"
      const items = raw.split(', ').filter(Boolean);
      
      return items.map(item => {
        const parts = item.split('|');
        return {
          title: parts[0]?.trim() || item,
          isFocused: false,
        };
      });
    } catch (error) {
      console.error('[MacOSAppController] getWindows error:', error);
      return [];
    }
  }

  async launchApp(appName: string, args?: string[]): Promise<boolean> {
    try {
      // 修复：-a 参数后跟 app 名称，--args 后跟应用参数
      const openArgs = ['-a', appName];
      if (args && args.length > 0) {
        openArgs.push('--args', ...args);
      }
      await execFileAsync('open', openArgs);
      return true;
    } catch (error) {
      console.error('[MacOSAppController] launchApp error:', error);
      return false;
    }
  }

  async closeApp(appName: string): Promise<boolean> {
    try {
      await execFileAsync('osascript', [
        '-e', `tell application "${appName}" to quit`
      ]);
      return true;
    } catch (error) {
      console.error('[MacOSAppController] closeApp error:', error);
      return false;
    }
  }

  async focusWindow(title: string): Promise<boolean> {
    try {
      await execFileAsync('osascript', [
        '-e', `tell application "${title}" to activate`
      ]);
      return true;
    } catch (error) {
      console.error('[MacOSAppController] focusWindow error:', error);
      return false;
    }
  }

  async screenshotActiveWindow(): Promise<string> {
    try {
      // macOS 截图到临时文件
      const tmpFile = `/tmp/lingjing_screenshot_${Date.now()}.png`;
      await execFileAsync('screencapture', ['-w', '-x', tmpFile]);
      const { stdout } = await execFileAsync('base64', ['-i', tmpFile]);
      // 清理临时文件
      execFile('rm', ['-f', tmpFile]);
      return stdout.trim();
    } catch (error) {
      console.error('[MacOSAppController] screenshotActiveWindow error:', error);
      return '';
    }
  }
}

// ============ Linux 实现 ============
class LinuxAppController implements IAppController {
  async getInstalledApps(): Promise<AppInfo[]> {
    // 优先尝试 dpkg（Debian/Ubuntu）
    try {
      const { stdout } = await execFileAsync('dpkg', ['-l']);
      const apps: AppInfo[] = [];
      stdout.split('\n').filter(line => line.startsWith('ii')).forEach(line => {
        const name = line.split(/\s+/)[1]?.split(':')[0];
        if (name) apps.push({ name, isRunning: false });
      });
      if (apps.length > 0) return apps;
    } catch {
      // dpkg 不可用，尝试 rpm
    }
    
    // 回退：rpm（RHEL/Fedora/CentOS）
    try {
      const { stdout } = await execFileAsync('rpm', ['-qa', '--queryformat', '%{NAME}\n']);
      const apps: AppInfo[] = [];
      stdout.split('\n').filter(Boolean).forEach(name => {
        apps.push({ name: name.trim(), isRunning: false });
      });
      return apps;
    } catch (error) {
      console.error('[LinuxAppController] getInstalledApps error:', error);
      return [];
    }
  }

  async getWindows(): Promise<WindowInfo[]> {
    // 优先使用 wmctrl（更可靠）
    try {
      const { stdout } = await execFileAsync('wmctrl', ['-l']);
      const windows: WindowInfo[] = [];
      stdout.split('\n').filter(Boolean).forEach(line => {
        // wmctrl -l 格式: "0x03800003  0 hostname 窗口标题"
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const title = parts.slice(3).join(' ');
          windows.push({ title, isFocused: false });
        }
      });
      if (windows.length > 0) return windows;
    } catch {
      // wmctrl 不可用
    }
    
    // 回退：xdotool
    try {
      const { stdout } = await execFileAsync('xdotool', [
        'search', '--onlyvisible', '--name', '.',
        'getwindowname', '%@'
      ]);
      // xdotool 对多个窗口每行输出一个窗口标题
      return stdout.split('\n').filter(Boolean).map(title => ({
        title: title.trim(),
        isFocused: false,
      }));
    } catch {
      // 最后尝试：直接列出所有窗口 ID
      try {
        const { stdout } = await execFileAsync('xdotool', [
          'search', '--onlyvisible', ''
        ]);
        return stdout.split('\n').filter(Boolean).map(id => ({
          title: `Window ${id.trim()}`,
          isFocused: false,
        }));
      } catch (error) {
        console.error('[LinuxAppController] getWindows error:', error);
        return [];
      }
    }
  }

  async launchApp(appName: string, args?: string[]): Promise<boolean> {
    try {
      const process = spawn(appName, args || [], {
        detached: true,
        stdio: 'ignore',
      });
      process.unref();
      return process.pid !== undefined;
    } catch (error) {
      console.error('[LinuxAppController] launchApp error:', error);
      return false;
    }
  }

  async closeApp(appName: string): Promise<boolean> {
    try {
      // 修复：xdotool 的正确语法是 search ... windowkill
      // 先搜索窗口 ID，然后杀死
      const { stdout } = await execFileAsync('xdotool', [
        'search', '--name', appName
      ]);
      const windowIds = stdout.trim().split('\n').filter(Boolean);
      if (windowIds.length > 0) {
        for (const wid of windowIds) {
          await execFileAsync('xdotool', ['windowkill', wid.trim()]);
        }
        return true;
      }
    } catch {
      // xdotool 失败，尝试 pkill
    }
    
    // 回退：pkill
    try {
      await execFileAsync('pkill', ['-f', appName]);
      return true;
    } catch (error) {
      console.error('[LinuxAppController] closeApp error:', error);
      return false;
    }
  }

  async focusWindow(title: string): Promise<boolean> {
    // 优先使用 wmctrl
    try {
      await execFileAsync('wmctrl', ['-a', title]);
      return true;
    } catch {
      // 回退：xdotool
      try {
        await execFileAsync('xdotool', [
          'search', '--name', title,
          'windowactivate'
        ]);
        return true;
      } catch (error) {
        console.error('[LinuxAppController] focusWindow error:', error);
        return false;
      }
    }
  }

  async screenshotActiveWindow(): Promise<string> {
    try {
      const tmpFile = `/tmp/lingjing_screenshot_${Date.now()}.png`;
      await execFileAsync('import', ['-window', 'root', tmpFile]);
      // 读取 base64
      const { stdout } = await execFileAsync('base64', [tmpFile]);
      execFile('rm', ['-f', tmpFile]);
      return stdout.trim();
    } catch {
      try {
        const tmpFile = `/tmp/lingjing_screenshot_${Date.now()}.png`;
        await execFileAsync('scrot', [tmpFile]);
        const { stdout } = await execFileAsync('base64', [tmpFile]);
        execFile('rm', ['-f', tmpFile]);
        return stdout.trim();
      } catch (error) {
        console.error('[LinuxAppController] screenshotActiveWindow error:', error);
        return '';
      }
    }
  }
}

// ============ 工厂函数 ============
export function createAppController(): IAppController {
  switch (process.platform) {
    case 'win32':
      return new WindowsAppController();
    case 'darwin':
      return new MacOSAppController();
    case 'linux':
      return new LinuxAppController();
    default:
      console.warn(`[AppController] Unsupported platform: ${process.platform}`);
      return new WindowsAppController();
  }
}
