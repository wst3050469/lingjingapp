import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
const WIN_REGISTRY_QUERY = 'reg query "HKLM\\SOFTWARE\\OpenSpace" /ve 2>nul';
const WIN_PATH_FALLBACKS = [
    'C:\\Program Files\\OpenSpace',
    'C:\\OpenSpace',
];
const LINUX_PATH_FALLBACKS = [
    '/opt/openspace',
    '/usr/local/bin/openspace',
];
function existsDir(p) {
    try {
        return fs.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
function existsFile(p) {
    try {
        return fs.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
export function detectOpenSpaceWindows() {
    try {
        const output = execSync(WIN_REGISTRY_QUERY, { encoding: 'utf-8', timeout: 5000 });
        const match = output.match(/REG_SZ\s+(.+)/);
        if (match && match[1].trim() && existsDir(match[1].trim())) {
            return { found: true, path: match[1].trim(), method: 'registry' };
        }
    }
    catch { }
    try {
        const whereOut = execSync('where openspace 2>nul', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (whereOut) {
            const exePath = whereOut.split('\n')[0].trim();
            return { found: true, path: path.dirname(exePath), method: 'PATH' };
        }
    }
    catch { }
    for (const fallback of WIN_PATH_FALLBACKS) {
        if (existsDir(fallback)) {
            return { found: true, path: fallback, method: 'fallback' };
        }
    }
    return { found: false, path: null, method: 'none' };
}
export function detectOpenSpaceLinux() {
    try {
        const whichOut = execSync('which openspace 2>/dev/null', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (whichOut && existsFile(whichOut)) {
            return { found: true, path: path.dirname(whichOut), method: 'which' };
        }
    }
    catch { }
    for (const fallback of LINUX_PATH_FALLBACKS) {
        if (existsDir(fallback)) {
            return { found: true, path: fallback, method: 'fallback' };
        }
    }
    return { found: false, path: null, method: 'none' };
}
export function detectOpenSpace() {
    return process.platform === 'win32'
        ? detectOpenSpaceWindows()
        : detectOpenSpaceLinux();
}
export function patchOpenSpaceIntegration() {
    const detection = detectOpenSpace();
    return {
        detection,
        wsBridgeReady: false,
        windowEmbedReady: false,
    };
}
export const LUA_FRAME_EXPORT = `-- OpenSpace 帧导出脚本
-- 在 OpenSpace 中执行，将渲染帧推送到灵境

local frameCount = 0
local exportInterval = 1  -- 每N帧导出一次

function onFrameCallback()
  frameCount = frameCount + 1
  if frameCount % exportInterval ~= 0 then return end

  local screenshot = openspace.renderScreenshot({
    resolution = { 1920, 1080 },
    format = "png"
  })

  -- 通过 WebSocket 推送到灵境
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
