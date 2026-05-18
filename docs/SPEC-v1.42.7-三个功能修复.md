# v1.42.7 — 修复 Preview/Spec/文件变更自动处理三大功能

## 概述

修复 Quest Mode 中三个从未正常工作的核心功能：Preview 实时预览、Spec 自动生成、文件变更自动处理。

---

## Bug 1: Preview 功能从未生效

### 根因分析

**问题 1a: URL 检测正则过于严格**

在 `packages/electron/src/ipc/quest-ipc.ts` 第 974 行：
```typescript
const urlMatch = event.text.match(/https?:\/\/localhost:\d+/);
```

正则只匹配 `localhost`，不匹配：
- `http://127.0.0.1:5173`（AI 经常使用 127.0.0.1）
- `http://0.0.0.0:3000`
- `http://[::1]:8080`
- 非标准端口如 `http://localhost:3001`

**问题 1b: iframe 加载被 Electron webSecurity 阻止**

在 `main.ts` 第 309 行 `webSecurity: true`，且 iframe 的 `src` 设置为 `http://localhost:XXXX`。Electron 中 `file://` 协议的渲染进程加载 `http://` 内容受同源策略限制。即便 iframe 有 `allow-same-origin`，跨协议加载仍可能被拦截。

**问题 1c: 预览 URL 没有错误反馈**

`QuestPreviewTab.tsx` 第 96-98 行 `handleIframeLoad` 只设置 `isLoading = false`，没有处理 iframe 加载失败的情况（如 404、连接拒绝、CSP 拦截）。用户看不到预览失败的提示。

### 修复方案

1. **URL 检测正则增强** — 同时匹配 localhost、127.0.0.1、0.0.0.0
2. **URL 去重** — 避免同一 URL 被重复发送 `preview_url` 事件
3. **iframe 加载错误处理** — 添加 `onError` 回退，显示加载失败提示
4. **注册协议豁免** — 在 Electron 主进程中添加 localhost 的权限豁免

### 影响文件

| 文件 | 变更 |
|:-----|:------|
| `packages/electron/src/ipc/quest-ipc.ts` | 增强 URL 正则 + 添加去重 |
| `packages/electron/src/main.ts` | 添加 session 协议豁免 |
| `packages/renderer/src/components/quest/QuestPreviewTab.tsx` | 添加错误处理 UI |

---

## Bug 2: Spec 自动生成未生效

### 根因分析

**问题 2a: 流式文本跨块截断 `:::spec` 块**

在 `quest-ipc.ts` 中，`detectSpecBlock` 使用正则 `/:::spec\s*\n([\s\S]*?)\n:::/` 在 `accumulatedText` 中查找完整 spec 块。但文本是通过流式 `onEvent` 回调逐步累积的：

```
Chunk 1: ":::spec\n# Feature\n\n## Overview\nSome text..."
Chunk 2: "...continued content\n\n## Steps\n1. Do this\n:::"  
```

如果 `:::` 闭合标记还没到达，`detectSpecBlock` 不会匹配。等完整块出现后再次扫描 `accumulatedText` 时应该能匹配。但问题在于 Agent **完成后再也没有 text 事件**，所以 spec 只能在 streaming 期间被检测。

查看代码确认：第 1069-1078 行有"最终扫描"逻辑，在 agent.run() 完成后再次调用 `detectSpecBlock`。但验收发现：
- 如果 AI 在 `done` 事件前已经输出了完整的 `:::spec` 块，那么 streaming 期间的检测应该已经捕获了
- 如果 AI 的 spec 输出分散在多个 text 事件中，需要等所有 chunk 累积后才能匹配

**真正的问题：** 正则 `:::spec\s*\n([\s\S]*?)\n:::` 要求 **闭合标记 `:::`** 在单独一行。但 AI 可能输出 `:::spec\n...content\n:::\n`（闭合后直接换行），或者 `:::spec\n...content\n:::\`（后面跟其他内容）。这种格式差异会导致匹配失败。

**问题 2b: 非 spec 场景不会生成 spec**

`composeQuestSystemPrompt` 只在 `scenario === 'spec'` 时注入 spec 指令。如果用户选择了 `prototype` 或 `tool` 场景，AI 根本不知道要生成 spec 文档。

### 修复方案

1. **正则增强** — 支持更灵活的 `:::` 闭合格式（允许尾部空格、不同换行符）
2. **完成后扫描保证** — 确保 `agent.run()` 完成后的最终扫描能检测到跨多块的 spec
3. **非 spec 场景增加可选提示** — 在 system prompt 末尾添加提示，告知 AI 输出 `:::spec` 块时会被自动识别

### 影响文件

| 文件 | 变更 |
|:-----|:------|
| `packages/electron/src/ipc/quest-ipc.ts` | 增强 `detectSpecBlock` 正则 + 事后扫描逻辑 |

---

## Bug 3: 文件变更处理（设置为自动）未生效

### 根因分析

**问题 3a: autoMode 含义被误解**

用户期望的"自动文件变更处理"是指：在 auto 模式下，AI 执行完文件写入/编辑后，变更 **自动被应用/接受**，而无需用户手动逐个点击接受。

但当前代码中 `autoMode === 'auto'` 只控制了 `wrapToolWithConfirmation` 的行为：
- Auto 模式：自动批准 bash 命令（非阻塞命令）和 MCP 工具的执行
- Manual 模式：每次执行都需要用户点击确认

**file_write/file_edit 工具从未被 wrapToolWithConfirmation 包裹** — 它们被 `wrapFileToolWithSnapshot` 包裹，只负责捕获文件变更快照，不控制是否执行。所以无论 auto/manual，文件变更都会被执行，但执行后都会以 `pending` 状态出现在 Changed Files 标签中。

**问题 3b: 没有"自动验收"机制**

`useQuestDiffStore` 中只有手动 `acceptFile`/`rejectFile`/`acceptAll`，没有根据 `autoMode` 自动验收的逻辑。在 `useQuestEvents.ts` 的 `file_snapshot` 事件处理器中（第 159-168 行），无论 autoMode 是什么，文件变更都标记为 `pending`。

### 修复方案

1. **auto 模式自动接受文件变更** — 在 `useQuestEvents.ts` 中处理 `file_snapshot` 事件时，如果当前任务的 `autoMode === 'auto'`，直接将文件变更状态设为 `accepted`
2. **透传 autoMode 到事件处理器** — 确保 `file_snapshot` 事件包含 autoMode 信息，或者在 store 中根据当前任务 autoMode 自动处理
3. **模型选择界面增加 autoMode 设置持久化** — 确保 auto 模式在任务间保持

### 影响文件

| 文件 | 变更 |
|:-----|:------|
| `packages/renderer/src/stores/quest-store.ts` | 新增 `getCurrentTaskAutoMode` 辅助方法 |
| `packages/renderer/src/hooks/useQuestEvents.ts` | 在 `file_snapshot` 处理器中添加 auto-accept 逻辑 |
| `packages/electron/src/ipc/quest-ipc.ts` | 透传 autoMode 到 `file_snapshot` 事件 |

---

## 实现步骤

1. **修复 Preview URL 检测** — 增强正则，匹配多种 localhost 变体
2. **修复 iframe 加载** — 添加错误处理 UI + Electron 协议豁免
3. **修复 Spec 检测** — 增强正则格式兼容性
4. **修复文件变更自动处理** — auto 模式下自动接受文件变更
5. **版本升级 + 构建 + 部署**

## 验证计划

1. **Preview**: 启动本地 dev server -> Quest 模式下验证 AI 输出 URL 后 iframe 自动加载
2. **Spec**: 启动 spec 场景任务 -> 确认 AI 输出 `:::spec` 块后 Spec 标签自动出现
3. **文件变更**: 设置 auto 模式 -> 确认 AI 修改文件后变更自动被接受（非 pending）
