# ACTIVE_TASK -- v1.51.0 Phase 93 发布中 🚀

## 状态：⏳ 构建中

| 项目 | 大小 | 状态 |
|:-----|:-----|:----:|
| 🐛 Bug1: Quest Agent生命周期管理 | 4项 | ✅ 全部修复 |
| 🐛 Bug2: 任务执行意外中断 | 5项 | ✅ 全部修复 |
| 🏗️ 持久记忆机制 | 3模块 | ✅ VectorMemory+SqliteAdapter |
| 📱 移动端APP完善 | 4项 | ✅ 心跳/Markdown/持久化/文件查看 |
| 🪟 Windows Setup | - | ⏳ 待构建 |
| 🪟 Windows Portable | - | ⏳ 待构建 |
| 🐧 Linux AppImage | - | ⏳ 待构建 |
| 🐧 Linux deb | - | ⏳ 待构建 |
| ☁️ versions.json | 全平台 | ⏳ 待更新 |
| 🔄 auto-update YAML | 1.51.0 | ⏳ 待更新 |

### Phase 93 修改文件清单 (15个)

**Bug1 (Quest Agent生命周期):**
- `packages/electron/src/ipc/agent-ipc.ts` — 添加 abortAllQuestAgents 调用
- `packages/renderer/src/components/quest/QuestView.tsx` — stopOnSwitch 串行 await
- `packages/renderer/src/hooks/useQuestEvents.ts` — epoch filter 增强
- `packages/electron/src/ipc/quest-ipc.ts` — runId guard

**Bug2 (任务执行意外中断):**
- `packages/core/dist/agent/agent.js` — MAX_NO_TOOL_RETRIES 3→5 + SINGLE_STEP_PATTERNS + turnTimeout emit + finish_reason续写
- `packages/core/dist/llm/openai.js` — done事件携带finishReason
- `packages/electron/src/ipc/agent-ipc.ts` — ASK_USER/CONFIRM_TIMEOUT reject→resolve

**架构3 (持久记忆):**
- `packages/core/src/fusion/vector-memory/vector-memory-store.ts` — 外部EmbedFn注入
- `packages/core/src/fusion/vector-memory/adapters/sqlite-adapter.ts` — 新文件
- `packages/core/src/fusion/index.ts` — 导出SqliteVectorAdapter

**功能4 (移动端):**
- `lingjing-mobile-standalone/src/stores/app-store.ts` — Zustand persist
- `lingjing-mobile-standalone/src/services/api.ts` — WebSocket心跳
- `lingjing-mobile-standalone/src/screens/ChatDetailScreen.tsx` — Markdown渲染
- `lingjing-mobile-standalone/src/screens/FileTreeScreen.tsx` — 文件查看Modal

**部署5:**
- `packages/electron/src/ipc/fusion/fusion-module-ipc.ts`
- `packages/electron/src/main.ts`

### Git
- ⏳ 待提交
