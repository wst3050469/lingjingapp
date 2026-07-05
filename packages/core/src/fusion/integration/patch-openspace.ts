/**
 * OpenSpace 集成完善补丁
 *
 * 包含：
 * - Windows/Linux 安装路径检测逻辑
 * - WebSocket 连接说明
 * - 窗口嵌入说明
 * - 帧导出 Lua 脚本示例
 * - 全球同步连接 Lua 脚本示例
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── OpenSpace 路径检测 ────────────────────────────────────────

export interface OpenSpaceDetectionResult {
  found: boolean;
  path: string | null;
  method: string;
  version?: string;
}

const WIN_REGISTRY_QUERY = 'reg query "HKLM\\SOFTWARE\\OpenSpace" /ve 2>nul';
const WIN_PATH_FALLBACKS = [
  'C:\\Program Files\\OpenSpace',
  'C:\\OpenSpace',
];

const LINUX_PATH_FALLBACKS = [
  '/opt/openspace',
  '/usr/local/bin/openspace',
];

function existsDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function detectOpenSpaceWindows(): OpenSpaceDetectionResult {
  // 1. 注册表查询
  try {
    const output = execSync(WIN_REGISTRY_QUERY, { encoding: 'utf-8', timeout: 5000 });
    const match = output.match(/REG_SZ\s+(.+)/);
    if (match && match[1].trim() && existsDir(match[1].trim())) {
      return { found: true, path: match[1].trim(), method: 'registry' };
    }
  } catch { /* ignore */ }

  // 2. PATH 环境变量
  try {
    const whereOut = execSync('where openspace 2>nul', { encoding: 'utf-8', timeout: 5000 }).trim();
    if (whereOut) {
      const exePath = whereOut.split('\n')[0].trim();
      return { found: true, path: path.dirname(exePath), method: 'PATH' };
    }
  } catch { /* ignore */ }

  // 3. 回退路径
  for (const fallback of WIN_PATH_FALLBACKS) {
    if (existsDir(fallback)) {
      return { found: true, path: fallback, method: 'fallback' };
    }
  }

  return { found: false, path: null, method: 'none' };
}

export function detectOpenSpaceLinux(): OpenSpaceDetectionResult {
  // 1. which openspace
  try {
    const whichOut = execSync('which openspace 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim();
    if (whichOut && existsFile(whichOut)) {
      return { found: true, path: path.dirname(whichOut), method: 'which' };
    }
  } catch { /* ignore */ }

  // 2. 回退路径
  for (const fallback of LINUX_PATH_FALLBACKS) {
    if (existsDir(fallback)) {
      return { found: true, path: fallback, method: 'fallback' };
    }
  }

  return { found: false, path: null, method: 'none' };
}

export function detectOpenSpace(): OpenSpaceDetectionResult {
  return process.platform === 'win32'
    ? detectOpenSpaceWindows()
    : detectOpenSpaceLinux();
}

// ─── 集成补丁主函数 ────────────────────────────────────────────

export interface OpenSpacePatchResult {
  detection: OpenSpaceDetectionResult;
  wsBridgeReady: boolean;
  windowEmbedReady: boolean;
}

/**
 * WebSocket 连接说明：
 * 需要在 bridge.ts 中注入真实 ws 库（当前为接口声明）
 * - 使用 'ws' npm 包建立与 OpenSpace 的 WebSocket 连接
 * - 默认端口: 4680 (OpenSpace 主控端口)
 * - 协议: JSON-RPC over WebSocket
 * - 示例: const ws = new WebSocket('ws://localhost:4680');
 *         ws.onmessage = (ev) => handleOpenSpaceEvent(JSON.parse(ev.data));
 */

/**
 * 窗口嵌入说明：
 * 需要在 renderer.ts 中注入 Electron BrowserWindow API
 * - 方案A: BrowserView 嵌入（推荐，支持同进程渲染）
 *   const view = new BrowserView({ webPreferences: { nodeIntegration: false } });
 *   view.setBounds({ x, y, width, height });
 *   view.webContents.loadURL('http://localhost:4680');
 * - 方案B: 子窗口（独立窗口，通过 IPC 通信）
 * - 方案C: 截屏流（适用于远程 OpenSpace，通过 WebSocket 截屏推送）
 */

export function patchOpenSpaceIntegration(): OpenSpacePatchResult {
  const detection = detectOpenSpace();
  return {
    detection,
    wsBridgeReady: detection.installed && detection.binaryPath !== null,
    windowEmbedReady: detection.installed,
  };
}

// ─── Lua 脚本示例 ──────────────────────────────────────────────

export const LUA_FRAME_EXPORT = `-- OpenSpace 帧导出脚本
-- 在 OpenSpace 中执行，将渲染帧推送到灵境AI

local frameCount = 0
local exportInterval = 1  -- 每N帧导出一次

function onFrameCallback()
  frameCount = frameCount + 1
  if frameCount % exportInterval ~= 0 then return end

  local screenshot = openspace.renderScreenshot({
    resolution = { 1920, 1080 },
    format = "png"
  })

  -- 通过 WebSocket 推送到灵境AI
  openspace.sendMessage("ws://localhost:4681", {
    type = "frame",
    data = screenshot,
    timestamp = openspace.time()
  })
end

openspace.bindCallback("PostFrame", onFrameCallback)
`;

export const LUA_GLOBE_SYNC = `-- OpenSpace 全球同步连接脚本
-- 用于多节点场景同步（地球/星空协同渲染）

local syncConfig = {
  masterHost = "localhost",
  masterPort = 4682,
  role = "follower",  -- "master" | "follower"
  sceneId = "default-earth",
  syncInterval = 0.05  -- 50ms 同步间隔
}

function connectToMaster()
  local ws = openspace.openWebSocket(
    "ws://" .. syncConfig.masterHost .. ":" .. syncConfig.masterPort
  )

  ws:onMessage(function(msg)
    local data = json.decode(msg)
    if data.type == "camera" then
      openspace.setCameraState(data.camera)
    elseif data.type == "time" then
      openspace.setTime(data.simulationTime)
    elseif data.type == "property" then
      openspace.setPropertyValue(data.uri, data.value)
    end
  end)

  return ws
end

if syncConfig.role == "follower" then
  local conn = connectToMaster()
  openspace.printInfo("Connected to master: " .. syncConfig.masterHost)
end
`;
