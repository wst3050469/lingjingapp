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
export interface OpenSpaceDetectionResult {
    found: boolean;
    path: string | null;
    method: string;
    version?: string;
}
export declare function detectOpenSpaceWindows(): OpenSpaceDetectionResult;
export declare function detectOpenSpaceLinux(): OpenSpaceDetectionResult;
export declare function detectOpenSpace(): OpenSpaceDetectionResult;
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
export declare function patchOpenSpaceIntegration(): OpenSpacePatchResult;
export declare const LUA_FRAME_EXPORT = "-- OpenSpace \u5E27\u5BFC\u51FA\u811A\u672C\n-- \u5728 OpenSpace \u4E2D\u6267\u884C\uFF0C\u5C06\u6E32\u67D3\u5E27\u63A8\u9001\u5230\u7075\u5883\n\nlocal frameCount = 0\nlocal exportInterval = 1  -- \u6BCFN\u5E27\u5BFC\u51FA\u4E00\u6B21\n\nfunction onFrameCallback()\n  frameCount = frameCount + 1\n  if frameCount % exportInterval ~= 0 then return end\n\n  local screenshot = openspace.renderScreenshot({\n    resolution = { 1920, 1080 },\n    format = \"png\"\n  })\n\n  -- \u901A\u8FC7 WebSocket \u63A8\u9001\u5230\u7075\u5883\n  openspace.sendMessage(\"ws://localhost:4681\", {\n    type = \"frame\",\n    data = screenshot,\n    timestamp = openspace.time()\n  })\nend\n\nopenspace.bindCallback(\"PostFrame\", onFrameCallback)\n";
export declare const LUA_GLOBE_SYNC = "-- OpenSpace \u5168\u7403\u540C\u6B65\u8FDE\u63A5\u811A\u672C\n-- \u7528\u4E8E\u591A\u8282\u70B9\u573A\u666F\u540C\u6B65\uFF08\u5730\u7403/\u661F\u7A7A\u534F\u540C\u6E32\u67D3\uFF09\n\nlocal syncConfig = {\n  masterHost = \"localhost\",\n  masterPort = 4682,\n  role = \"follower\",  -- \"master\" | \"follower\"\n  sceneId = \"default-earth\",\n  syncInterval = 0.05  -- 50ms \u540C\u6B65\u95F4\u9694\n}\n\nfunction connectToMaster()\n  local ws = openspace.openWebSocket(\n    \"ws://\" .. syncConfig.masterHost .. \":\" .. syncConfig.masterPort\n  )\n\n  ws:onMessage(function(msg)\n    local data = json.decode(msg)\n    if data.type == \"camera\" then\n      openspace.setCameraState(data.camera)\n    elseif data.type == \"time\" then\n      openspace.setTime(data.simulationTime)\n    elseif data.type == \"property\" then\n      openspace.setPropertyValue(data.uri, data.value)\n    end\n  end)\n\n  return ws\nend\n\nif syncConfig.role == \"follower\" then\n  local conn = connectToMaster()\n  openspace.printInfo(\"Connected to master: \" .. syncConfig.masterHost)\nend\n";
//# sourceMappingURL=patch-openspace.d.ts.map