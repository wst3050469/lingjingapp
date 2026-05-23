# Phase 96: Quest Agent 生命周期深度修复

## 日期: 2026-05-23

## 修复的4个断裂点

### 断裂点1 (Phase 95已修复): runId过滤器丢弃lifecycle事件
- **文件**: `packages/renderer/src/hooks/useQuestEvents.ts`
- **修复**: done和status_change事件豁免runId过滤

### 断裂点2: Mount时无自动resume逻辑
- **文件**: 
  - `packages/renderer/src/components/quest/QuestView.tsx` (line 73-103)
  - `packages/renderer/src/components/quest/QuestConversation.tsx` (line 93-125)
- **修复**: Mount useEffect检查activeTask.status==='paused'时自动调用quest.resume()

### 断裂点3: handleSend始终调用quest:run而非quest:resume
- **文件**: `packages/renderer/src/components/quest/QuestConversation.tsx` (line 195-223)
- **修复**: handleSend智能判断：如果任务有历史消息且status为paused/idle/failed，调用quest.resume()而非quest.run()

### 断裂点4: stopOnSwitch设idle而非paused + Resume按钮条件过严
- **文件**:
  - `packages/electron/src/ipc/quest-ipc.ts` (line 3007, 3017)
  - `packages/renderer/src/components/quest/QuestConversation.tsx` (line 332)
- **修复**:
  - stopOnSwitch改设status='paused'（原来是'idle'）
  - Resume按钮条件从status==='paused'放宽为status==='paused'||status==='idle'

## Bug2增强修复

### error/done事件清理残留状态
- **文件**: `packages/renderer/src/hooks/useQuestEvents.ts`
- **修复**:
  - error事件: 增加setActiveRunId(null)和removeRunningTask(taskId)
  - done事件: 增加setActiveRunId(null)
- 防止error/done后activeRunId残留导致后续事件被runId filter丢弃

## 打包注意事项
- 需重新编译electron主进程（quest-ipc.ts修改）
- 需重新编译renderer（QuestView/QuestConversation/useQuestEvents修改）
- 无新增依赖
- 无数据库schema变更
