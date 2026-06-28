/**
 * Audio Control IPC - Cross-platform audio device enumeration and control
 */

import { ipcMain } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface AudioDevice {
  id: string;
  name: string;
  type: "input" | "output" | "both";
  isActive: boolean;
  sampleRate?: number;
  channels?: number;
  rawName?: string; // 原始系统设备名（Linux pactl sink name 等）
}

export interface ActiveAudioDevices {
  output: AudioDevice | null;
  input: AudioDevice | null;
}

async function enumerateAudioDevices(): Promise<AudioDevice[]> {
  const platform = process.platform;
  try {
    switch (platform) {
      case "win32": return await enumerateWindowsAudio();
      case "darwin": return await enumerateMacOSAudio();
      case "linux": return await enumerateLinuxAudio();
      default: return getDefaultDevices();
    }
  } catch (err: any) {
    console.error("[AudioControl] error:", err.message);
    return getDefaultDevices();
  }
}

async function enumerateWindowsAudio(): Promise<AudioDevice[]> {
  try {
    const script = "Get-WmiObject -Class Win32_SoundDevice | Select-Object Name, PSPath";
    const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
    const devices: AudioDevice[] = [];
    for (const line of stdout.trim().split("\n").filter(l => l.trim())) {
      const parts = line.split("|");
      if (parts.length >= 2 && parts[0]) {
        devices.push({ id: "win_" + parts[0].replace(/[^a-zA-Z0-9]/g, "_"), name: parts[1], type: "output", isActive: true });
      }
    }
    return devices.length > 0 ? devices : getDefaultDevices();
  } catch { return getDefaultDevices(); }
}

async function enumerateMacOSAudio(): Promise<AudioDevice[]> {
  const devices: AudioDevice[] = [];
  try {
    const { stdout } = await execFileAsync("system_profiler", ["SPAudioDataType", "-json"]);
    const data = JSON.parse(stdout);
    const items = data._items || [];
    for (const item of items) {
      if (item._name && item._class) {
        const type: "input" | "output" = ["Input", "Microphone"].includes(item._class) ? "input" : "output";
        devices.push({ id: item._name, name: item._name, type, isActive: item.default_device === "Yes" });
      }
    }
  } catch {}
  return devices.length > 0 ? devices : getDefaultDevices();
}

async function enumerateLinuxAudio(): Promise<AudioDevice[]> {
  const devices: AudioDevice[] = [];
  try {
    const { stdout: sinks } = await execFileAsync("pactl", ["list", "short", "sinks"]);
    sinks.trim().split("\n").filter(l => l.trim()).forEach((line: string) => {
      const p = line.split("\t");
      if (p.length >= 2) devices.push({ id: "sink-" + p[0], name: p[1].trim(), rawName: p[1].trim(), type: "output", isActive: false });
    });
  } catch {}
  try {
    const { stdout: sources } = await execFileAsync("pactl", ["list", "short", "sources"]);
    sources.trim().split("\n").filter(l => l.trim()).forEach((line: string) => {
      const p = line.split("\t");
      if (p.length >= 2) devices.push({ id: "source-" + p[0], name: p[1].trim(), rawName: p[1].trim(), type: "input", isActive: false });
    });
  } catch {}
  return devices.length > 0 ? devices : getDefaultDevices();
}

function getDefaultDevices(): AudioDevice[] {
  return [
    { id: "default-output", name: "Default Output", type: "output", isActive: true },
    { id: "default-input", name: "Default Input", type: "input", isActive: true }
  ];
}

export function registerAudioControlIpc(): void {
  ipcMain.handle("audio:enumerate-devices", async () => ({
    success: true, data: await enumerateAudioDevices()
  }));
  ipcMain.handle("audio:get-active-device", async () => {
    const devices = await enumerateAudioDevices();
    return { success: true, data: {
      output: devices.find(d => d.type === "output" && d.isActive) || null,
      input: devices.find(d => d.type === "input" && d.isActive) || null
    }};
  });
  ipcMain.handle("audio:set-output-device", async (_event, { deviceId, deviceName }: { deviceId: string; deviceName?: string }) => {
    const platform = process.platform;
    const name = deviceName || deviceId;

    try {
      if (platform === "win32") {
        // Windows: PowerShell + WMI (保持现有逻辑)
        const script = `Get-WmiObject -Class Win32_SoundDevice | Where-Object { $_.Name -like '*${name.replace(/'/g, "''")}*' } | ForEach-Object { $_.PSPath }`;
        const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
        if (!stdout.trim()) return { success: false, error: `未找到设备: ${name}` };
        return { success: true, deviceId, platform: "win32" };
      }

      if (platform === "darwin") {
        // macOS: SwitchAudioSource CLI (brew install switchaudio-osx)
        try {
          await execFileAsync("SwitchAudioSource", ["-s", name]);
          return { success: true, deviceId, platform: "darwin" };
        } catch {
          return { success: false, error: `切换失败，请确认已安装 SwitchAudioSource（brew install switchaudio-osx）且设备名正确: ${name}` };
        }
      }

      if (platform === "linux") {
        // Linux: PulseAudio pactl → set-default-sink
        // 先查找 sink 名称（rawName 或 id 中的数字索引）
        try {
          const { stdout } = await execFileAsync("pactl", ["list", "short", "sinks"]);
          const lines = stdout.trim().split("\n").filter(l => l.trim());
          for (const line of lines) {
            const p = line.split("\t");
            if (p.length >= 2) {
              const sinkIndex = p[0].trim();
              const sinkName = p[1].trim();
              // 匹配：deviceName/rawName 精确匹配 或 deviceId 匹配 "sink-N"
              if (sinkName === name || deviceId === `sink-${sinkIndex}` || sinkName === deviceId) {
                await execFileAsync("pactl", ["set-default-sink", sinkName]);
                return { success: true, deviceId, platform: "linux", sinkName };
              }
            }
          }
          return { success: false, error: `未找到 sink 设备: ${name}` };
        } catch {
          return { success: false, error: "Linux 音频切换需要 PulseAudio (pactl) 或 PipeWire 兼容层" };
        }
      }

      return { success: false, error: `不支持的操作系统: ${platform}` };
    } catch (err: any) {
      return { success: false, error: err.message || "切换输出设备失败" };
    }
  });
  ipcMain.handle("audio:check-mic-available", async () => {
    const devices = await enumerateAudioDevices();
    const micDevice = devices.find(d => d.type === "input" && d.isActive);
    return { success: true, available: !!micDevice, device: micDevice };
  });
  console.log("[AudioControl] 4 IPC handlers registered");
}
