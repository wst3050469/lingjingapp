const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '..', 'packages/core/dist/fusion/integration/index.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the patch-renderer export line
const oldExport = "export { FUSION_SIDEBAR_PANELS, OPENSPACE_SIDEBAR_PANELS, FUSION_PANEL_COMPONENTS, OPENSPACE_PANEL_COMPONENTS, ALL_SIDEBAR_PANELS, ALL_PANEL_COMPONENTS, getPanelIconEntries, } from './patch-renderer.js';\n";
content = content.replace(oldExport, '');

// Update the comment
const oldComment = `/**
 * Batch C (P1 Renderer UI路由注册 + scifi-dark主题切换 + OpenSpace集成完善):
 * - patch-renderer.tsx     → Fusion/OpenSpace 侧栏面板注册 + 懒加载组件映射
 * - patch-theme-switch.tsx → scifi-dark 主题选项 + CSS变量 + 主题选择菜单
 * - patch-openspace.ts     → OpenSpace 路径检测 + WebSocket/窗口嵌入说明 + Lua脚本
 */`;

const newComment = `/**
 * Batch C (P1 Renderer UI):
 * - patch-theme-switch.tsx → scifi-dark 主题选项 + CSS变量 + 主题选择菜单
 * - patch-openspace.ts     → OpenSpace 路径检测 + WebSocket/窗口嵌入说明 + Lua脚本
 * NOTE: patch-renderer excluded (imports react, crashes Electron main process)
 */`;

content = content.replace(oldComment, newComment);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed integration/index.js');
console.log('Removed patch-renderer export');
console.log('Updated comment');
