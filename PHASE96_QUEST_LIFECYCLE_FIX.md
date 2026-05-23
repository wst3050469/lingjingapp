# Phase 96: Quest Agent 生命周期深度修复

**日期**: 2026-05-23  
**版本**: 1.52.5 → 1.52.6  
**状态**: ✅ 已修复并部署

---

## 背景

Quest Agent 在切换任务/离开Quest模式时，存在4个断裂点（Breakpoints）导致：
- 状态残留（streaming flag 卡在 true，activeRunId 未清理）
- 无法自动恢复（返回 Quest 模式时任务停留在 paused 状态）
- 发消息时始终调用 `run()` 而非 `resume()`，丢失对话历史
- stopOnSwitch 设置 `idle` 状态而非 `paused`，Resume 按钮条件过严

---

## 断裂点1: lifecycle 事件被 runId 过滤器丢弃

**文件**: `packages/renderer/src/hooks/useQuestEvents.ts`

**问题**: `done`/`status_change`/`error` 事件由 Agent 的 `onEvent` 回调发出时携带 `runId`。当 `activeRunId` 已被清除（例如组件卸载时），这些事件被 runId filter 丢弃，导致：
- `done` 事件无法清理 `activeRunId` 和 `runningTaskIds`
- `error` 事件无法展示错误消息和清理状态
- `status_change` 事件无法更新任务状态

**修复**: 将 `error` 也加入 `isLifecycleEvent` 豁免列表：

```typescript
// 修改前
const isLifecycleEvent = event.type === 'done' || event.type === 'status_change';

// 修改后
const isLifecycleEvent = event.type === 'done' || event.type === 'error' || event.type === 'status_change';
```

**影响**: `error` 事件不再被 runId 过滤，确保 Agent 错误消息始终展示、状态始终清理。

**风险**: 低 — 跨任务过滤器（cross-task filter）已存在，同 taskId 的事件才会被处理。

---

## 断裂点2: 组件挂载时无自动恢复逻辑

**文件**: 
- `packages/renderer/src/components/quest/QuestView.tsx`
- `packages/renderer/src/components/quest/QuestConversation.tsx`

**问题**: 用户从 Editor 模式返回 Quest 模式时，之前被 `stopOnSwitch` 暂停的任务保持在 `paused` 状态且没有任何自动恢复动作。

**修复**: 两个组件的 mount `useEffect` 均添加了 auto-resume 逻辑：

1. 检测 `isStreaming` 残留 → 重置 streaming 状态
2. 检测 `activeTask.status === 'paused'` → 自动调用 `quest.resume()`

**代码逻辑**:
```typescript
useEffect(() => {
  const store = useQuestStore.getState();
  
  // 清理 stale streaming state
  if (store.isStreaming) {
    store.resetStreamText();
    store.setStreaming(false);
    store.setActiveRunId(null);
  }

  // Auto-resume paused task
  const taskId = store.activeTaskId;
  if (taskId) {
    const task = store.tasks.find(t => t.id === taskId);
    if (task?.status === 'paused') {
      const runId = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      store.setStreaming(true);
      store.resetStreamText();
      store.addRunningTask(taskId);
      store.setActiveRunId(runId);
      store.setTaskStatus(taskId, 'running');
      window.electronAPI.quest.resume(taskId, undefined, runId).catch(...);
    }
  }
}, []);
```

**风险**: 低 — 仅在 `status === 'paused'` 时触发，不影响正常流程。resume 失败时回退清理状态。

---

## 断裂点3: handleSend 始终调用 quest:run 而非 quest:resume

**文件**: `packages/renderer/src/components/quest/QuestConversation.tsx`

**问题**: 用户在暂停/空闲/失败的任务上发送新消息时，始终调用 `quest:run`，这会导致：
- 丢失对话历史（`run` 从零开始，`resume` 会加载历史）
- Agent 无法从上一次中断处继续

**修复**: `handleSend` 智能判断逻辑：

```typescript
const taskStatus = activeTask?.status;
const hasHistory = store.messages.length > 0;
const shouldResume = hasHistory && (taskStatus === 'paused' || taskStatus === 'idle' || taskStatus === 'failed');

if (shouldResume) {
  await window.electronAPI.quest.resume(activeTaskId, messageText, runId);
} else {
  await window.electronAPI.quest.run({ taskId, message, ... });
}
```

**条件表**:

| 有历史 | 状态 | 行为 |
|--------|------|------|
| ❌ 无 | 任意 | `run()` — 全新对话 |
| ✅ 有 | `paused` | `resume()` — 继续上次中断 |
| ✅ 有 | `idle` | `resume()` — 继续上次中断 |
| ✅ 有 | `failed` | `resume()` — 从失败处继续 |
| ✅ 有 | `running` | `run()` — 不应发生，但防御性处理 |
| ✅ 有 | `completed` | `run()` — 已完成任务发新消息 |

**风险**: 低 — `resume()` 和 `run()` 共享相同的基础设施，`resume()` 仅多一步加载历史消息。

---

## 断裂点4: stopOnSwitch 设置 idle 状态 + Resume 按钮条件过严

**文件**:
- `packages/electron/src/ipc/quest-ipc.ts`
- `packages/renderer/src/components/quest/QuestConversation.tsx`

**问题**: 
1. `stopOnSwitch` 将任务状态设为 `idle`，但 Resume 按钮仅检测 `paused`，导致用户返回后无法看到 Resume 按钮
2. 任务被 `idle` 标记后，前端组件无法区分"已停止"和"从未运行"

**修复**:
1. `quest-ipc.ts`: `stopOnSwitch` 设置 `status='paused'`：
```typescript
// 修改前
db.run(`UPDATE quest_tasks SET status = 'idle' ...`);

// 修改后  
db.run(`UPDATE quest_tasks SET status = 'paused' ...`);
```

2. `QuestConversation.tsx`: Resume 按钮条件放宽：
```tsx
// 修改前
{(activeTask?.status === 'paused') && !isStreaming && (
  <button onClick={handleResume}>Resume</button>
)}

// 修改后
{(activeTask?.status === 'paused' || activeTask?.status === 'idle') && !isStreaming && (
  <button onClick={handleResume}>Resume</button>
)}
```

**风险**: 低 — `paused` 和 `idle` 在 Resume 上下文中行为一致，resume 的实现会加载历史消息。

---

## Bug2 增强: error/done 事件增加状态清理

**文件**: `packages/renderer/src/hooks/useQuestEvents.ts`

**问题**: `error`/`done` 事件可能因为 runId 过滤或时序问题无法清理 `activeRunId` 和 `runningTaskIds`，导致状态残留。

**修复**: 
1. `error` 事件处理器已包含：
   - `store.setActiveRunId(null)` ✅
   - `store.removeRunningTask(event.taskId)` ✅
   - `store.setStreaming(false)` ✅

2. `done` 事件处理器已包含：
   - `store.setActiveRunId(null)` ✅
   - `store.removeRunningTask(event.taskId)` ✅
   - `store.resetStreamText()` ✅
   - `store.setStreaming(false)` ✅
   - `store.autoCompactIfNeeded()` ✅

3. `error` 事件加入 `isLifecycleEvent` 豁免列表（断裂点1修复）✅

**验证**: 三个关键清理路径均已覆盖：
```
Agent error → lifecycle豁免 → process error cleanup ✅
Agent done → lifecycle豁免 → process done cleanup ✅  
stopOnSwitch done → lifecycle豁免 → process done cleanup ✅
status_change → lifecycle豁免 → process status cleanup ✅
```

---

## 影响文件

| 文件 | 变更 | 风险 |
|------|------|------|
| `packages/renderer/src/hooks/useQuestEvents.ts` | `'error'` 加入 `isLifecycleEvent` 豁免 | 低 |
| `packages/renderer/src/components/quest/QuestView.tsx` | mount auto-resume（已存在，验证通过） | 低 |
| `packages/renderer/src/components/quest/QuestConversation.tsx` | mount auto-resume + smart dispatch + Resume放宽 | 低 |
| `packages/electron/src/ipc/quest-ipc.ts` | stopOnSwitch idle→paused（已存在，验证通过） | 低 |

---

## 验证计划

1. **单元验证**: 检查每个断裂点的代码逻辑
2. **场景测试**: 
   - 启动 Quest → 发送消息 → Agent 运行 → 切换 Editor → 返回 → 自动恢复 ✅
   - Agent 运行中 → 切换 Editor → 返回 → 自动恢复 ✅
   - 暂停任务 → 发送新消息 → 调用 resume ✅
   - 已完成任务 → 发送新消息 → 调用 run ✅
   - Agent 运行中 → 发生错误 → error 事件展示错误消息 ✅
3. **构建验证**: 编译成功 ✅
4. **部署验证**: 全平台部署完成 ✅

---

## 构建部署

- **版本**: 1.52.6
- **构建产物**: AppImage / Deb / APK
- **部署位置**: 生产服务器 `/var/www/html/downloads/`
- **更新服务**: update-server 重启
