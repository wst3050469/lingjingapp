# OpenSpace 非侵入式融合 — 实施任务清单

> 本文档将需求规格（REQ-OS01~REQ-OS10）和技术设计转化为可执行的实施任务，按 3 个批次组织。
> 新代码根目录：`packages/core/src/fusion/openspace/`
> 不含打包部署任务（由独立 AI 执行）。

---

## 批次 1：核心集成层（P0）

### 1. 公共类型定义

- [x] **T-OS01** — 定义 OpenSpace 融合层公共类型
  - 优先级：P0
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/types.ts`（新建）
  - 预估行数：~200
  - 依赖任务：无
  - 实现要点：
    - 定义 `InstallationDetection`、`StartConfig`、`ProcessRunState`、`ProcessHealthStatus`、`HealthCheckResult` 等进程管理类型
    - 定义 `OpenSpaceMessage`、`ScriptLanguage`、`ScriptRequest`、`ScriptResult`、`BridgeConfig`、`PropertySubscription` 等通信类型
    - 定义 `SceneContext`、`SecurityReviewResult`、`SecurityViolation`、`GenerationRequest`、`GenerationResult`、`ScriptTemplate` 等脚本生成类型
    - 定义 `OpenSpaceProfile`、`ProfileModule`、`CameraPosition`、`RenderingOptions`、`ProfileTemplate` 等 Profile 类型
    - 定义 `DisplayMode`、`WindowState`、`RendererConfig` 等渲染器类型
    - 定义 `DatasetStatus`、`DatasetEntry`、`DatasetMetadata` 等数据集类型
    - 定义 `RecordingConfig`、`RecordingState`、`RecordingSession`、`PlaybackControl` 等录制类型
    - 定义 `SyncRole`、`SyncState`、`SyncConnectionConfig`、`SyncStatus`、`SyncProfile` 等同步类型
    - 定义 `OpenSpaceFusionConfig` 融合配置类型
    - 导出所有接口和类型别名

---

### 2. OpenSpaceProcessManager — 进程生命周期管理

- [x] **T-OS02** — 实现 OpenSpaceProcessManager 核心逻辑
  - 优先级：P0
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/process-manager.ts`（新建）
  - 预估行数：~350
  - 依赖任务：T-OS01
  - 实现要点：
    - 实现 `IOpenSpaceProcessManager` 接口，包含 `detectInstallation()`、`setManualPath()`、`start()`、`stop()`、`restart()`、`onStateChange()` 方法
    - **安装路径检测**：Windows 下查询注册表 `HKLM\SOFTWARE\OpenSpace` → PATH 环境变量 → 常见路径 `C:\Program Files\OpenSpace`；Linux 下 `which openspace` → PATH → `/opt/openspace`
    - **版本兼容性检测**：启动参数 `--version` 获取版本号，与最低兼容版本 `v0.19.0` 比较并返回 `compatible` 字段
    - **子进程启动**：使用 `child_process.spawn(execPath, args, { detached: false, stdio: ['pipe', 'pipe', 'pipe'] })`，收集 stdout/stderr 用于日志和就绪信号检测
    - **就绪信号**：监听 stdio 输出的 WebSocket 端口号（正则匹配），或等待 WebSocket 端口可连接
    - **优雅停止**：发送 Lua 脚本 `openspace.exit()` → 等待 10s → `SIGTERM` → 再等 5s → `SIGKILL`
    - **健康检查**：定时器（默认 5s 间隔），组合 `process.kill(pid, 0)` 存活检测 + WebSocket ping/pong
    - **状态变更通知**：`onStateChange` handler 注册机制，支持多个监听器
    - **EventBus 集成**：状态变更时发布 `openspace:started` / `openspace:stopped` / `openspace:health_changed` 事件
    - **禁止写入 OpenSpace 安装目录**：非侵入式原则保证

---

### 3. OpenSpaceBridge — 双向通信桥接

- [x] **T-OS03** — 实现 OpenSpaceBridge 核心逻辑
  - 优先级：P0
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/bridge.ts`（新建）
  - 预估行数：~400
  - 依赖任务：T-OS01, T-OS02
  - 实现要点：
    - 实现 `IOpenSpaceBridge` 接口，包含 `connect()`、`disconnect()`、`sendScript()`、`subscribeProperty()`、`onEvent()` 方法
    - **WebSocket 连接**：使用 `ws` 库连接 `ws://localhost:{port}`，实现 JSON-RPC 2.0 协议
    - **请求格式**：`{ jsonrpc: "2.0", id, method: "execute", params: { script, language } }`
    - **响应解析**：成功 `{ jsonrpc: "2.0", id, result }`；错误 `{ jsonrpc: "2.0", id, error: { code, message } }`
    - **命令队列**：使用 `AsyncQueue` 保证命令顺序执行，当前命令超时（默认 30s）或完成后出队，发送下一条
    - **断线重连**：WebSocket `close` 事件触发重连逻辑：最多 5 次，间隔 3s，指数退避
    - **传输回退**：WebSocket 连接失败时自动回退到 stdio（读取子进程 stdout 解析 JSON-RPC 响应）
    - **事件桥接**：OpenSpace 场景事件 → 反序列化 → EventBus 发布 `openspace:scene_changed` / `openspace:property_changed` / `openspace:scene_loaded`
    - **审计日志**：每条命令记录 `{ correlationId, timestamp, script, result, duration }` 到审计日志
    - **CircuitBreaker**：包装 `sendScript` 调用，连续 N 次通信失败后熔断，保护灵境不因 OpenSpace 异常而阻塞
    - **属性订阅**：`subscribeProperty` 返回取消订阅函数，订阅的属性变更通过 callback 回调

---

### 4. 脚本安全审查

- [x] **T-OS04** — 实现脚本安全审查模块
  - 优先级：P0
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/security-review.ts`（新建）
  - 预估行数：~150
  - 依赖任务：T-OS01
  - 实现要点：
    - 定义危险操作模式正则列表：`os.remove`、`io.popen`、`require('os')`、`require('subprocess')`、网络请求模式、文件系统写入模式等
    - 实现正则匹配扫描函数，返回 `SecurityReviewResult`（passed、riskLevel、violations）
    - 按匹配模式严重度标记 riskLevel：critical/medium/high/low
    - 支持 Lua、JavaScript、Python 三种语言的安全审查（不同语言对应不同危险模式库）
    - 导出 `reviewScript(script: string, language: ScriptLanguage): SecurityReviewResult` 函数

---

### 5. 内置脚本模板库

- [x] **T-OS05** — 实现内置脚本模板库
  - 优先级：P0
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/script-templates.ts`（新建）
  - 预估行数：~200
  - 依赖任务：T-OS01
  - 实现要点：
    - 定义并导出 `BUILTIN_TEMPLATES: ScriptTemplate[]` 常量数组
    - 包含模板：`navigate_to_body`（navigation）、`set_camera_distance`（navigation）、`set_time`（time）、`toggle_layer`（layer）、`start_recording`（recording）、`stop_recording`（recording）、`load_dataset`（scene）、`unload_dataset`（scene）
    - 每个模板包含 name、category、description、keywords、scriptTemplate（含占位符 `{target}`/`{distance}`/`{date}` 等）、highRisk 标记
    - 导出 `matchTemplate(input: string, category?: string): ScriptTemplate | null` 函数，基于关键词匹配
    - 导出 `fillTemplate(template: ScriptTemplate, params: Record<string, string>): string` 函数，替换占位符

---

### 6. openspace_execute 工具

- [x] **T-OS06** — 实现 openspace_execute Agent 工具
  - 优先级：P0
  - 所属模块：`fusion/openspace/tools`
  - 涉及文件：`packages/core/src/fusion/openspace/tools/openspace-execute.ts`（新建）
  - 预估行数：~180
  - 依赖任务：T-OS01, T-OS03, T-OS04
  - 实现要点：
    - 实现 `Tool` 接口，`name = 'openspace_execute'`，`description = '执行 OpenSpace 脚本命令，控制宇宙可视化场景'`
    - 定义 JSON Schema 参数：`script`（string, required）、`language`（enum: lua/javascript/python, required）、`timeout`（number, default 30000）、`scripts`（array of string, 批量执行）
    - `riskLevel = 'medium'`
    - **执行流程**：① 检查 `OpenSpaceProcessManager.runState` → 未运行则返回错误；② 安全审查（复用 `reviewScript`）；③ 审查不通过则返回错误；④ 通过 `OpenSpaceBridge.sendScript` 发送脚本；⑤ 等待执行结果（超时控制）；⑥ 返回 `ToolResult`
    - **批量执行**：`scripts` 数组存在时按顺序执行每条命令，返回每条命令的执行结果数组
    - **可用性守卫**：OpenSpace 未启动时返回 `{ isError: true, content: "OpenSpace 未运行，请先启动" }`
    - **语言校验**：不支持的 language 返回参数校验错误

---

### 7. EventBus 事件主题扩展

- [x] **T-OS07** — 扩展 EventBus 事件主题
  - 优先级：P0
  - 所属模块：`fusion/openspace`
  - 涉及文件：
    - `packages/core/src/fusion/openspace/fusion-adapter.ts`（新建）
    - `packages/core/src/fusion/EventBus` 类型定义（修改，追加 `openspace:*` 主题）
  - 预估行数：~180
  - 依赖任务：T-OS01
  - 实现要点：
    - 在 `EventTopic` 类型中追加 16 个 OpenSpace 事件主题：`openspace:started`、`openspace:stopped`、`openspace:health_changed`、`openspace:script_executed`、`openspace:script_failed`、`openspace:scene_changed`、`openspace:scene_loaded`、`openspace:property_changed`、`openspace:recording_started`、`openspace:recording_stopped`、`openspace:recording_paused`、`openspace:sync_connected`、`openspace:sync_disconnected`、`openspace:sync_failed`、`openspace:window_changed`、`openspace:embed_fallback`
    - 实现 `OpenSpaceFusionAdapter` 类：构造函数接收 `IEventBus` 和 `IHookRegistry`，`initialize(config)` 初始化融合模块，`shutdown()` 降级关闭，`healthCheck()` 返回各模块健康状态
    - 注册 `BEFORE_TOOL_EXECUTE` Hook：拦截 `openspace_execute` 调用，执行安全审查
    - 注册 `AFTER_TOOL_EXECUTE` Hook：记录脚本执行审计日志，发布 EventBus 事件
    - 在 FusionInitializer 初始化序列中追加 `openspace` 模块，支持 `enabled: false` 禁用

---

### 8. 数据库迁移

- [x] **T-OS08** — 实现 migration004_openspace 数据库迁移
  - 优先级：P0
  - 所属模块：`electron/database`
  - 涉及文件：`packages/electron/src/database/migrations/migration004_openspace.ts`（新建）
  - 预估行数：~120
  - 依赖任务：无
  - 实现要点：
    - 创建 `openspace_config` 表（key TEXT PRIMARY KEY, value TEXT, updated_at TEXT）
    - 创建 `openspace_sessions` 表（id, profile_id, started_at, stopped_at, state, config_json, frame_count, output_path, description, created_at, updated_at）
    - 创建 `openspace_scripts` 审计日志表（id, correlation_id, script, language, source, result, error, duration_ms, risk_level, security_passed, executed_at）
    - 创建 `openspace_profiles` 表（id, name, modules_json, dataset_paths_json, camera_json, rendering_json, file_path, template_name, created_at, updated_at）
    - 创建 `openspace_sync_profiles` 表（id, name, server_address, port, password, default_role, created_at, updated_at）
    - 创建索引：idx_openspace_sessions_state、idx_openspace_sessions_profile、idx_openspace_scripts_correlation、idx_openspace_scripts_language、idx_openspace_scripts_executed、idx_openspace_profiles_name
    - 插入默认配置行（install_path、websocket_port=4680、command_timeout=30000、health_check_interval=5000、max_reconnect_attempts=5、reconnect_interval=3000、preferred_transport=websocket、min_compatible_version=0.19.0）
    - Fusion 模块注册行：`INSERT INTO fusion_config (module_name, enabled, config_json) VALUES ('openspace', 0, '{}')`

---

### 9. 模块导出

- [x] **T-OS09** — 实现 OpenSpace 模块入口导出
  - 优先级：P0
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/index.ts`（新建）
  - 预估行数：~40
  - 依赖任务：T-OS01, T-OS02, T-OS03, T-OS04, T-OS05, T-OS06, T-OS07
  - 实现要点：
    - 导出 `OpenSpaceProcessManager`、`OpenSpaceBridge`、`OpenSpaceScriptGenerator`、`OpenSpaceProfileManager`、`OpenSpaceRenderer`、`OpenSpaceDatasetBrowser`、`OpenSpaceRecorder`、`OpenSpaceSyncManager`、`OpenSpaceFusionAdapter`
    - 导出 `OpenSpaceExecuteTool`
    - 导出所有公共类型（从 `types.ts` re-export）
    - 导出 `reviewScript`、`BUILTIN_TEMPLATES`、`matchTemplate`、`fillTemplate`

---

## 批次 2：AI 增强层（P1）

### 10. OpenSpaceScriptGenerator — AI 脚本生成器

- [x] **T-OS10** — 实现 OpenSpaceScriptGenerator 核心逻辑
  - 优先级：P1
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/script-generator.ts`（新建）
  - 预估行数：~300
  - 依赖任务：T-OS01, T-OS03, T-OS04, T-OS05
  - 实现要点：
    - 实现 `IOpenSpaceScriptGenerator` 接口：`generate()`、`getTemplates()`、`reviewScript()`
    - **模板匹配优先**：先对用户输入做关键词匹配，匹配成功则 `fillTemplate` 填充参数，`fromTemplate=true`
    - **LLM 全量生成**：模板匹配失败时，调用 `ILLMAdapter.chat()` 发送转换请求，System Prompt 包含 OpenSpace Lua/JS API 参考和当前场景上下文
    - **上下文注入**：调用 `OpenSpaceBridge.sendScript` 获取当前场景状态（已加载模块、相机位置、可见天体等），作为 LLM 上下文
    - **安全审查**：调用 `reviewScript()` 对生成的脚本进行安全审查
    - **预览确认**：`highRisk=true`（导航到新目标、加载大型数据集）时，返回 `requiresConfirmation=true`
    - **重试机制**：LLM 生成语法无效脚本时，将错误信息反馈给 LLM 重新生成（最多 2 次）
    - **多语言脚本支持**：根据 `language` 参数生成对应语言的脚本（Lua/JavaScript/Python）
    - `getTemplates()` 直接返回 `BUILTIN_TEMPLATES`

---

### 11. OpenSpaceProfileManager — Profile/场景管理

- [x] **T-OS11** — 实现 OpenSpaceProfileManager 核心逻辑
  - 优先级：P1
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/profile-manager.ts`（新建）
  - 预估行数：~280
  - 依赖任务：T-OS01, T-OS02, T-OS03
  - 实现要点：
    - 实现 `IOpenSpaceProfileManager` 接口：`list()`、`get()`、`create()`、`update()`、`delete()`、`importFromPath()`、`exportToPath()`、`getTemplates()`、`applyFromTemplate()`、`hotReload()`
    - **文件格式**：Profile 以 Lua 脚本形式存储（`.profile` 扩展名），内部以结构化对象管理，读写时做 Lua ↔ JSON 转换
    - **存储位置**：灵境工作目录下 `.openspace/profiles/`，不写入 OpenSpace 安装目录
    - **Lua 解析**：使用简化的 Lua AST 解析器提取模块引用和属性赋值，解析失败时报告具体行号
    - **模板预设**：内置"太阳系探索"、"深空观测"、"太空任务追踪"等模板
    - **热更新**：OpenSpace 运行中时，通过 `OpenSpaceBridge.sendScript` 发送属性更新脚本，无需重启进程
    - **Profile 文件损坏处理**：解析失败时报告具体错误位置，不覆盖原文件
    - **数据集路径校验**：引用的数据集目录在文件系统中不存在时标记为"不可用"

---

### 12. OpenSpaceDatasetBrowser — 数据集浏览器

- [x] **T-OS12** — 实现 OpenSpaceDatasetBrowser 核心逻辑
  - 优先级：P1
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/dataset-browser.ts`（新建）
  - 预估行数：~220
  - 依赖任务：T-OS01, T-OS03
  - 实现要点：
    - 实现 `IOpenSpaceDatasetBrowser` 接口：`scan()`、`getDetails()`、`search()`、`load()`、`unload()`、`setDatasetRoot()`
    - **目录扫描**：递归扫描数据集根目录，按子目录名分类（stars/galaxies/planets/missions）
    - **元信息解析**：读取 `.scene` 文件和 `dataset.ini`/`metadata.json` 获取描述、分辨率、来源
    - **状态校验**：`downloaded` — 目录存在且关键文件完整；`partial` — 目录存在但缺失关键文件；`corrupted` — 文件校验失败；`not_downloaded` — 目录不存在
    - **搜索功能**：按名称、类型、标签模糊搜索，支持 category 和 status 过滤
    - **加载/卸载**：通过 `OpenSpaceBridge.sendScript` 发送 `openspace.addSceneGraphNode` / `openspace.removeSceneGraphNode`
    - **数据集目录不可访问**：路径不存在或权限不足时显示空状态

---

### 13. OpenSpace Skills — 导航技能

- [x] **T-OS13** — 实现 openspace-navigation Skill
  - 优先级：P1
  - 所属模块：`fusion/openspace/skills`
  - 涉及文件：`packages/core/src/fusion/openspace/skills/openspace-navigate/SKILL.md`（新建）
  - 预估行数：~60
  - 依赖任务：T-OS06
  - 实现要点：
    - YAML frontmatter：`name: openspace-navigation`、`version: 1.0.0`、`level: builtin`、`triggers: [飞, 导航, 前往, 放大, 缩小, 旋转, 相机]`、`tools: [openspace_execute]`、`requires_openspace: true`
    - Markdown 内容：描述导航技能用途、操作指令列表（飞往天体、设置距离、时间控制、旋转视角）
    - 每个操作指令包含对应的 Lua 脚本示例
    - 可用性由 `OpenSpaceProcessManager.runState === 'running'` 决定

---

### 14. OpenSpace Skills — 场景管理技能

- [x] **T-OS14** — 实现 openspace-scene-management Skill
  - 优先级：P1
  - 所属模块：`fusion/openspace/skills`
  - 涉及文件：`packages/core/src/fusion/openspace/skills/openspace-scene/SKILL.md`（新建）
  - 预估行数：~60
  - 依赖任务：T-OS06
  - 实现要点：
    - YAML frontmatter：`name: openspace-scene-management`、`version: 1.0.0`、`level: builtin`、`triggers: [加载, 卸载, 显示, 隐藏, 切换场景, Profile, 数据集]`、`tools: [openspace_execute]`、`requires_openspace: true`
    - Markdown 内容：描述场景管理技能用途、操作指令列表（加载/卸载数据集、切换 Profile、图层显隐、属性修改）
    - 可用性由 `OpenSpaceProcessManager.runState === 'running'` 决定

---

### 15. OpenSpace Skills — 录制技能

- [x] **T-OS15** — 实现 openspace-recording Skill
  - 优先级：P1
  - 所属模块：`fusion/openspace/skills`
  - 涉及文件：`packages/core/src/fusion/openspace/skills/openspace-record/SKILL.md`（新建）
  - 预估行数：~60
  - 依赖任务：T-OS06
  - 实现要点：
    - YAML frontmatter：`name: openspace-recording`、`version: 1.0.0`、`level: builtin`、`triggers: [录制, 开始录制, 停止录制, 回放, 帧导出]`、`tools: [openspace_execute]`、`requires_openspace: true`
    - Markdown 内容：描述录制技能用途、操作指令列表（开始/停止录制、配置参数、回放控制）
    - 可用性由 `OpenSpaceProcessManager.runState === 'running'` 决定

---

### 16. Skill 可用性联动机制

- [x] **T-OS16** — 实现 OpenSpace Skill 可用性联动机制
  - 优先级：P1
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/fusion-adapter.ts`（修改）
  - 预估行数：~50
  - 依赖任务：T-OS07, T-OS13, T-OS14, T-OS15
  - 实现要点：
    - 监听 `OpenSpaceProcessManager.onStateChange`，当 `runState === 'running'` 时标记所有 OpenSpace Skill 为"可用"并参与意图匹配
    - 当 `runState !== 'running'` 时标记所有 OpenSpace Skill 为"不可用"，不参与意图匹配
    - 在 `OpenSpaceFusionAdapter.initialize()` 中注册此监听器

---

## 批次 3：UI 与高级功能层（P2）

### 17. OpenSpaceRenderer — 可视化窗口嵌入

- [x] **T-OS17** — 实现 OpenSpaceRenderer 核心逻辑
  - 优先级：P2
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/renderer.ts`（新建）
  - 预估行数：~200
  - 依赖任务：T-OS01, T-OS02
  - 实现要点：
    - 实现 `IOpenSpaceRenderer` 接口：`embed()`、`setMode()`、`setDisplay()`、`onStateChange()`
    - **嵌入模式**：Electron 主进程通过 `child_window` 嵌入，获取 OpenSpace 窗口句柄 → `setParentWindow` 设为 BrowserWindow 子窗口
    - **独立模式**：OpenSpace 以独立系统窗口运行，灵境仅通过脚本命令控制
    - **全屏模式**：发送 Lua 脚本 `openspace.setPropertyValue("RenderEngine.Window.Fullscreen", true)`
    - **多显示器支持**：通过 Electron `screen` 模块获取显示器列表，将窗口定位到目标显示器
    - **窗口状态同步**：监听 OpenSpace 窗口事件（移动/缩放/最大化/最小化/关闭），通过 EventBus 广播 `openspace:window_changed`
    - **嵌入失败回退**：无法获取窗口句柄时自动回退到独立窗口模式，发布 `openspace:embed_fallback` 事件

---

### 18. OpenSpaceRecorder — 会话录制回放

- [x] **T-OS18** — 实现 OpenSpaceRecorder 核心逻辑
  - 优先级：P2
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/recorder.ts`（新建）
  - 预估行数：~250
  - 依赖任务：T-OS01, T-OS03
  - 实现要点：
    - 实现 `IOpenSpaceRecorder` 接口：`startRecording()`、`stopRecording()`、`pauseRecording()`、`resumeRecording()`、`getSessions()`、`playback`（play/pause/seek/setSpeed）
    - **帧导出控制**：通过脚本设置 `FrameExport.Enabled`/`FrameExport.Resolution`/`FrameExport.Framerate` 等属性
    - **回放实现**：基于录制会话中保存的操作时间线，按时间间隔重发脚本命令序列
    - **磁盘监测**：录制期间监测输出目录磁盘空间，不足时自动停止并保存已有帧
    - **会话持久化**：录制会话元信息存入 `openspace_sessions` 数据库表
    - **EventBus**：录制状态变更时发布 `openspace:recording_started` / `openspace:recording_stopped` / `openspace:recording_paused`
    - **录制中断处理**：OpenSpace 异常退出时标记录制会话为"interrupted"，保存已有的帧序列

---

### 19. OpenSpaceSyncManager — 全球同步连接管理

- [x] **T-OS19** — 实现 OpenSpaceSyncManager 核心逻辑
  - 优先级：P2
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/sync-manager.ts`（新建）
  - 预估行数：~200
  - 依赖任务：T-OS01, T-OS03
  - 实现要点：
    - 实现 `IOpenSpaceSyncManager` 接口：`connect()`、`disconnect()`、`setRole()`、`getStatus()`、`listProfiles()`、`createProfile()`、`deleteProfile()`
    - **连接控制**：通过脚本发送 `openspace.sync.connect` 命令，传入服务器地址和认证信息
    - **角色切换**：发送 `openspace.sync.setRole` 命令，Host 推送状态，Client 跟随
    - **状态监控**：订阅 OpenSpace 同步状态属性，实时更新延迟和客户端数量
    - **SyncProfile 管理**：以 Lua 格式存储在灵境工作目录 `.openspace/sync-profiles/` 下
    - **EventBus**：状态变更时发布 `openspace:sync_connected` / `openspace:sync_disconnected` / `openspace:sync_failed`
    - **同步认证失败**：密码不正确时标记状态为 `auth_failed`
    - **同步服务器不可达**：连接超时后标记状态为 `failed`，不重试

---

### 20. IPC 注册

- [x] **T-OS20** — 注册 openspace:* 系列 IPC 通道
  - 优先级：P2
  - 所属模块：`electron/ipc`
  - 涉及文件：`packages/electron/src/ipc/openspace-ipc.ts`（新建）
  - 预估行数：~300
  - 依赖任务：T-OS02, T-OS03, T-OS10, T-OS11, T-OS12, T-OS17, T-OS18, T-OS19
  - 实现要点：
    - 实现 `registerOpenSpaceIpc()` 函数，使用 `ipcMain.handle` 注册所有 IPC 通道
    - **进程管理通道**：`openspace:detect`、`openspace:setPath`、`openspace:start`、`openspace:stop`、`openspace:health`
    - **通信通道**：`openspace:execute`、`openspace:subscribe`
    - **脚本生成通道**：`openspace:generateScript`、`openspace:getTemplates`
    - **Profile 管理通道**：`openspace:profile:list`、`openspace:profile:get`、`openspace:profile:create`、`openspace:profile:update`、`openspace:profile:delete`、`openspace:profile:hotReload`、`openspace:profile:import`、`openspace:profile:export`
    - **渲染器通道**：`openspace:renderer:setMode`、`openspace:renderer:setDisplay`
    - **数据集通道**：`openspace:dataset:scan`、`openspace:dataset:search`、`openspace:dataset:load`、`openspace:dataset:unload`
    - **录制通道**：`openspace:recording:start`、`openspace:recording:stop`、`openspace:recording:pause`、`openspace:recording:sessions`
    - **同步通道**：`openspace:sync:connect`、`openspace:sync:disconnect`、`openspace:sync:status`
    - **状态推送**：`openspace:stateChange`（M→R 方向，使用 `webContents.send`）

---

### 21. Zustand Store

- [x] **T-OS21** — 实现 OpenSpace Zustand Store
  - 优先级：P2
  - 所属模块：`renderer/stores`
  - 涉及文件：`packages/renderer/src/stores/openspace-store.ts`（新建）
  - 预估行数：~250
  - 依赖任务：T-OS01
  - 实现要点：
    - 定义 `OpenSpaceStoreState`：runState、health、installation、bridgeConnected、transport、currentScript、currentLanguage、scriptResult、scriptTemplates、profiles、activeProfileId、windowState、datasets、datasetRoot、recordingState、recordingSessions、currentSessionId、syncStatus、degraded、installGuideVisible
    - 定义 `OpenSpaceStoreActions`：detectInstallation、setManualPath、startOpenSpace、stopOpenSpace、executeScript、generateScript、各 CRUD 操作
    - 每个 action 内部调用 `ipcRenderer.invoke('openspace:*', ...)` 与 Main 进程通信
    - 监听 `openspace:stateChange` IPC 推送，自动更新 store 状态

---

### 22. UI 组件 — OpenSpacePanel 主面板

- [x] **T-OS22** — 实现 OpenSpacePanel 主面板组件
  - 优先级：P2
  - 所属模块：`renderer/components/openspace`
  - 涉及文件：`packages/renderer/src/components/openspace/OpenSpacePanel.tsx`（新建）
  - 预估行数：~200
  - 依赖任务：T-OS21
  - 实现要点：
    - 进程启动/停止按钮（调用 `startOpenSpace()`/`stopOpenSpace()`）
    - 健康状态指示灯（healthy=绿色、degraded=黄色、unhealthy=红色、stopped=灰色）
    - 进程运行状态文本显示（stopped/starting/running/stopping/failed）
    - 场景信息摘要（当前 Profile、已加载模块数量）
    - 窗口模式切换（嵌入/独立/全屏）
    - OpenSpace 未安装时显示降级状态和安装引导入口

---

### 23. UI 组件 — OpenSpaceScriptEditor 脚本编辑器

- [x] **T-OS23** — 实现 OpenSpaceScriptEditor 脚本编辑器组件
  - 优先级：P2
  - 所属模块：`renderer/components/openspace`
  - 涉及文件：`packages/renderer/src/components/openspace/OpenSpaceScriptEditor.tsx`（新建）
  - 预估行数：~250
  - 依赖任务：T-OS21
  - 实现要点：
    - Monaco Editor 嵌入，支持 Lua 语法高亮
    - 脚本语言选择器（Lua/JavaScript/Python）
    - 脚本模板选择器（下拉列表，选中后填充到编辑器）
    - 安全审查提示（审查不通过时红色高亮违规位置）
    - 执行按钮（调用 `executeScript()`）和预览按钮（高风险脚本先预览）
    - 执行结果展示区（成功/失败、返回值、执行耗时）
    - AI 生成按钮（调用 `generateScript()`，将自然语言输入转为脚本）

---

### 24. UI 组件 — OpenSpaceDatasetTree 数据集树

- [x] **T-OS24** — 实现 OpenSpaceDatasetTree 数据集树组件
  - 优先级：P2
  - 所属模块：`renderer/components/openspace`
  - 涉及文件：`packages/renderer/src/components/openspace/OpenSpaceDatasetTree.tsx`（新建）
  - 预估行数：~200
  - 依赖任务：T-OS21
  - 实现要点：
    - 按分类展示数据集目录树（stars/galaxies/planets/missions）
    - 状态图标（已下载=绿色、未下载=灰色、部分下载=黄色、损坏=红色）
    - 元信息弹窗（名称、大小、来源、分辨率、最后更新时间）
    - 加载/卸载按钮（直接操作当前场景）
    - 搜索框（按名称/类型/标签搜索）
    - 数据集根路径设置入口

---

### 25. UI 组件 — OpenSpaceProfileManager Profile 管理

- [x] **T-OS25** — 实现 OpenSpaceProfileManager Profile 管理组件
  - 优先级：P2
  - 所属模块：`renderer/components/openspace`
  - 涉及文件：`packages/renderer/src/components/openspace/OpenSpaceProfileManager.tsx`（新建）
  - 预估行数：~250
  - 依赖任务：T-OS21
  - 实现要点：
    - Profile 列表（显示名称、模块数量、最后更新时间）
    - 模板选择器（太阳系探索、深空观测、太空任务追踪）
    - 模块勾选面板（太阳系、银河系、数字宇宙目录等）
    - 参数编辑表单（相机初始位置、渲染选项）
    - 导入/导出按钮
    - 热更新按钮（OpenSpace 运行中时可用）
    - Profile 解析失败时显示错误行号和原因

---

### 26. UI 组件 — OpenSpaceRecorderPanel 录制回放

- [x] **T-OS26** — 实现 OpenSpaceRecorderPanel 录制回放组件
  - 优先级：P2
  - 所属模块：`renderer/components/openspace`
  - 涉及文件：`packages/renderer/src/components/openspace/OpenSpaceRecorderPanel.tsx`（新建）
  - 预估行数：~200
  - 依赖任务：T-OS21
  - 实现要点：
    - 录制启停按钮（开始/停止/暂停）
    - 参数配置表单（分辨率 640-7680×480-4320、帧率 1-120、格式 PNG/JPG/TIFF、输出路径）
    - 录制状态指示（idle/recording/paused/completed/interrupted）
    - 会话历史列表（时间戳、时长、帧数、描述）
    - 回放控制条（播放、暂停、跳转帧、速度调节）

---

### 27. UI 组件 — OpenSpaceInstallGuide 安装引导

- [x] **T-OS27** — 实现 OpenSpaceInstallGuide 安装引导组件
  - 优先级：P2
  - 所属模块：`renderer/components/openspace`
  - 涉及文件：`packages/renderer/src/components/openspace/OpenSpaceInstallGuide.tsx`（新建）
  - 预估行数：~120
  - 依赖任务：T-OS21
  - 实现要点：
    - OpenSpace 未安装时的降级提示
    - 下载链接（OpenSpace GitHub Releases）
    - 系统要求说明（OpenGL 4.6、C++23 运行时、CMake 4.0+、Windows/Linux x64）
    - 手动路径设置输入框 + 自动检测按钮
    - macOS 不支持提示（Apple Silicon 不兼容 OpenGL 4.6）

---

### 28. 降级与兼容性测试

- [x] **T-OS28** — 降级容错与兼容性验证
  - 优先级：P2
  - 所属模块：`fusion/openspace`
  - 涉及文件：`packages/core/src/fusion/openspace/` （修改 fusion-adapter.ts 等相关文件）
  - 预估行数：~150
  - 依赖任务：T-OS07, T-OS17, T-OS22
  - 实现要点：
    - **降级验证 1**：OpenSpace 未安装时，灵境所有非 OpenSpace 功能 100% 正常运行
    - **降级验证 2**：OpenSpace 启动失败时，Agent 工具调用返回明确错误，Skill 标记为"不可用"
    - **降级验证 3**：OpenSpace 运行中异常退出时，10s 内检测并通知，提供重启选项
    - **降级验证 4**：通信断开且重连失败时，标记降级模式，禁用脚本执行，保留离线功能（Profile 管理）
    - **降级验证 5**：窗口嵌入失败时自动回退到独立窗口模式
    - **降级验证 6**：`openspace_execute` 被调用但 OpenSpace 未运行时返回明确错误
    - **兼容性验证 1**：仅 Windows x64 和 Linux x64 平台启用，macOS 禁用
    - **兼容性验证 2**：OpenSpace 版本 ≥ v0.19.0 兼容，低于此版本警告
    - **兼容性验证 3**：融合层接口变更向后兼容，旧版 Profile 可正常加载
    - **兼容性验证 4**：OpenSpace 可在灵境外独立运行，不引入对灵境的运行时依赖

---

## 任务汇总

| 批次 | 优先级 | 任务数量 | 任务 ID 范围 | 覆盖需求 |
|---|---|---|---|---|
| 批次 1 | P0 | 9 | T-OS01 ~ T-OS09 | REQ-OS01, REQ-OS02, REQ-OS09（部分）, EventBus 扩展, DB 迁移 |
| 批次 2 | P1 | 7 | T-OS10 ~ T-OS16 | REQ-OS03, REQ-OS04, REQ-OS06, REQ-OS09（完整）, REQ-OS10 |
| 批次 3 | P2 | 12 | T-OS17 ~ T-OS28 | REQ-OS05, REQ-OS07, REQ-OS08, IPC/UI/Store/降级 |

**总计**：28 个任务，覆盖全部 10 项需求（REQ-OS01 ~ REQ-OS10）及降级兼容性保障。

**预估总代码行数**：~4,950 行
