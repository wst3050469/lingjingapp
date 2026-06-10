# Spec: 跨会话持久记忆 + 跨设备云端记忆搜索

## 概述

修复两个核心记忆系统问题：
1. **跨会话持久记忆**: 当前系统在不同会话之间无法保留历史上下文，新会话丢失之前学到的内容
2. **跨设备云端记忆搜索**: 用户无法从不同设备搜索和访问云端记忆

## 根因分析

### 问题1：跨会话持久记忆
- **`agent-ipc.ts`** 的 `searchExpertMemory()` 函数（第272-289行）只搜索 `category = 'expert-learning'` 的记忆
- 但 `memory-service.ts` 的 `searchMemories()` 函数搜索 **所有分类**，却未被 `agent-ipc.ts` 使用
- 因此 memory 用 `saveMemoryWithDedup()` 保存后，新会话加载时只检索到 `expert-learning` 分类，所有 `preference/project/workflow/issue/knowledge` 分类的记忆全部丢失
- `compactChat()`（对话摘要）存在但未注入记忆系统

### 问题2：跨设备云端记忆搜索
- `cloud:memories:list` 已存在但只列出/基本搜索，无专用语义搜索
- 启动时不会从云端拉取记忆并合并到本地
- MemoryTab 只能搜索本地记忆，缺少云端记忆搜索 UI
- preload 未暴露 `cloud:memories:search` 桥接

## 修改方案

### 修改的文件

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `packages/electron/src/ipc/agent-ipc.ts` | 修改 | 改用 `searchMemories()` 全类别搜索 + 注入记忆到system prompt |
| `packages/electron/src/ipc/cloud-ipc.ts` | 修改 | 新增 `cloud:memories:search` IPC + 启动时自动拉取云端记忆 |
| `packages/electron/src/ipc/ipc-verifier.ts` | 修改 | 添加新IPC通道到白名单 |
| `packages/electron/src/preload.ts` | 修改 | 暴露 `cloud.memories.search` + `memory.pullFromCloud` |
| `packages/renderer/src/types/electron.d.ts` | 修改 | 添加新API的类型声明 |
| `packages/renderer/src/components/settings/tabs/MemoryTab.tsx` | 修改 | 增加云端搜索UI |

### 调用链

```
问题1 调用链:
  agent:run (新会话启动)
    → 改用 searchMemories() 替代 searchExpertMemory()
    → 全类别搜索 + 注入system prompt
    → 新会话获得完整历史记忆
    
问题2 调用链:
  用户打开 MemoryTab → 点"云端搜索"
    → renderer 调用 window.electronAPI.cloud.memories.search(query)
    → preload → ipcRenderer.invoke('cloud:memories:search', { query })
    → cloud-ipc.ts: cloud:memories:search handler
    → CloudSyncClient.listMemories(query)
    → 返回结果渲染到 UI

  应用启动时:
    autoConnectCloud() → 连接后自动 pull 云端记忆
    → memory:pull-from-cloud → 合并到本地 SQLite
```

## 实施步骤

1. **agent-ipc.ts**: 用 `searchMemories()` 替代 `searchExpertMemory()`，注入全部记忆到 system prompt
2. **cloud-ipc.ts**: 新增 `cloud:memories:search` IPC handler，调用 `cloudClient.listMemories(query)`
3. **cloud-ipc.ts**: 新增 `cloud:memories:search` handler + auto-pull on startup
4. **preload.ts**: 暴露新API桥接
5. **electron.d.ts**: 添加类型声明
6. **ipc-verifier.ts**: 添加新通道到白名单
7. **MemoryTab.tsx**: 添加云端搜索UI
8. **版本更新**: v1.64.14 → v1.64.15
9. **构建部署**: 全平台构建 + 部署

## 潜在风险

| 风险 | 级别 | 缓解措施 |
|------|------|---------|
| 云端搜索需网络 | 低 | 失败时优雅降级提示 |
| 大量记忆注入prompt | 低 | `searchMemories()` 已限制 LIMIT 10 |
| 自动拉取记忆冲突 | 低 | `saveMemoryWithDedup()` 已处理去重 |
| 不影响现有quest/agent功能 | 极低 | 仅新增通道，不修改现有逻辑 |

## 测试点

1. 用户偏好「喜欢Python」→ 新Session → Agent回复体现Python偏好
2. 项目记忆「本项目用Vue3+TypeScript」→ 新Session → Agent推荐Vue3方案
3. 云端搜索关键词 → 返回其他设备保存的记忆
4. 设备A保存记忆 → 设备B启动 → 自动同步该记忆
5. 离线时操作 → 恢复网络后自动同步
