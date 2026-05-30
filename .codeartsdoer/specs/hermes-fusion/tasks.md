# Hermes Fusion 融合增强 — 实施任务清单

> **关键变更**：已移除Docker沙箱/容器沙箱功能（SandboxAdapter、DockerSandboxManager），REQ-H12现为ConnectorHub扩展接口。
> **需求覆盖**：REQ-H01~REQ-H12 + REQ-H14 + REQ-H15，共14个需求项。
> **原则**：零修改、插件化、独立旁路、可降级、无隐式依赖、增量接口。

---

## 批次1：基础设施层（P0）

### 1.1 EventBus 事件总线

- [ ] **T-H14-01** 实现EventBus核心类与类型定义
  - **优先级**：P0
  - **所属模块**：fusion/event-bus
  - **涉及文件**：`packages/core/src/fusion/event-bus/types.ts`（新建）、`packages/core/src/fusion/event-bus/event-bus.ts`（新建）
  - **预估行数**：200
  - **依赖任务**：无
  - **实现要点**：
    - 定义 `EventTopic` 联合类型（agent:message_start/end、agent:tool_call/result、agent:compaction、memory:updated/window_compacted、vector:synced、review:completed/failed、skill:loaded/blocked/executed、dag:completed/failed/node_completed、parallel:completed、model:fallback、user_model:updated、cron:registered/executed）
    - 定义 `EventMessage<T>`、`EventHandler<T>`、`SubscribeOptions`、`PublishOptions`、`EventFilter`、`UnsubscribeFn` 接口
    - 定义 `IEventBus` 接口（publish、subscribe、addFilter、healthCheck）
    - 实现 `EventBus` 类：内部维护 `Map<string, Set<Subscriber>>`、全局过滤器数组、指标计数器
    - publish方法：构造EventMessage → 全局过滤器过滤 → 主题匹配订阅者 → 按优先级排序 → 逐个执行handler（超时100ms跳过） → 异常捕获不中断

- [ ] **T-H14-02** 实现EventBus指标采集与降级策略
  - **优先级**：P0
  - **所属模块**：fusion/event-bus
  - **涉及文件**：`packages/core/src/fusion/event-bus/event-bus.ts`（修改）、`packages/core/src/fusion/event-bus/metrics.ts`（新建）
  - **预估行数**：80
  - **依赖任务**：T-H14-01
  - **实现要点**：
    - 定义 `EventBusMetrics`（totalPublished、totalDelivered、totalErrors、avgDeliveryMs、throughputPerSec）
    - 在publish/subscribe中埋点采集指标
    - 实现降级：初始化失败时所有publish/subscribe为no-op，模块独立运行
    - 实现healthCheck接口

- [ ] **T-H14-03** 实现EventBus单元测试
  - **优先级**：P0
  - **所属模块**：fusion/event-bus
  - **涉及文件**：`packages/core/src/fusion/event-bus/__tests__/event-bus.test.ts`（新建）
  - **预估行数**：150
  - **依赖任务**：T-H14-02
  - **实现要点**：
    - 测试publish/subscribe基本功能
    - 测试多订阅者按优先级排序执行
    - 测试超时跳过（回调超过100ms）
    - 测试异常隔离（某订阅者异常不影响其他订阅者）
    - 测试全局过滤器
    - 测试吞吐量（1000事件/秒）
    - 测试降级行为

### 1.2 HookRegistry Hook机制

- [ ] **T-H15-01** 实现HookRegistry核心类与类型定义
  - **优先级**：P0
  - **所属模块**：fusion/hook-registry
  - **涉及文件**：`packages/core/src/fusion/hook-registry/types.ts`（新建）、`packages/core/src/fusion/hook-registry/hook-registry.ts`（新建）
  - **预估行数**：180
  - **依赖任务**：T-H14-01
  - **实现要点**：
    - 定义 `HookPoint` 枚举（BEFORE_LLM_CALL、AFTER_LLM_CALL、BEFORE_TOOL_EXECUTE、AFTER_TOOL_EXECUTE、BEFORE_SKILL_LOAD、AFTER_SKILL_LOAD、BEFORE_MEMORY_WRITE、AFTER_COMPACTION）
    - 定义 `HookContext`（point、data可修改、original不可变）、`HookCallback`、`HookOptions`、`HookEntry` 接口
    - 定义 `IHookRegistry` 接口（register、unregister、execute、healthCheck）
    - 实现 `HookRegistry` 类：内部维护 `Map<HookPoint, HookEntry[]>`
    - register方法：生成唯一ID，创建HookEntry，按priority插入排序
    - execute方法：查找HookEntry → 按priority升序 → 逐个执行callback（sync模式await，async模式Promise.race + timeout） → 异常捕获 → 返回最终context

- [ ] **T-H15-02** 实现Hook超时跳过与降级策略
  - **优先级**：P0
  - **所属模块**：fusion/hook-registry
  - **涉及文件**：`packages/core/src/fusion/hook-registry/hook-registry.ts`（修改）
  - **预估行数**：60
  - **依赖任务**：T-H15-01
  - **实现要点**：
    - 实现超时逻辑：Promise.race([callback(context), timeoutPromise])，超时自动跳过
    - sync模式：await执行但设超时上限
    - async模式：不阻塞主流程，fire-and-forget + 超时保护
    - 异常捕获：Hook回调异常记录日志，不中断主流程
    - 降级：初始化失败时execute直接返回原context

- [ ] **T-H15-03** 实现HookRegistry单元测试
  - **优先级**：P0
  - **所属模块**：fusion/hook-registry
  - **涉及文件**：`packages/core/src/fusion/hook-registry/__tests__/hook-registry.test.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H15-02
  - **实现要点**：
    - 测试register/unregister基本功能
    - 测试回调按priority排序执行
    - 测试sync/async两种模式
    - 测试超时跳过
    - 测试异常隔离
    - 测试context修改传递
    - 测试降级行为

### 1.3 适配器基础框架

- [ ] **T-ADP-01** 定义适配器统一类型与版本化接口
  - **优先级**：P0
  - **所属模块**：fusion/adapters
  - **涉及文件**：`packages/core/src/fusion/adapters/types.ts`（新建）、`packages/core/src/fusion/adapters/index.ts`（新建）
  - **预估行数**：100
  - **依赖任务**：T-H14-01, T-H15-01
  - **实现要点**：
    - 定义 `LLMAdapter` 接口（version、call、getModel、isAvailable）
    - 定义 `MemoryAdapter` 接口（version、write、query）
    - 定义 `SkillAdapter` 接口（version、register、load、list）
    - 定义 `ToolAdapter` 接口（version、register、get）
    - 定义 `SchedulerAdapter` 接口（version、register、cancel、list）
    - 所有适配器包含 `version` 字段，版本不兼容时拒绝加载
    - 导出适配器工厂方法

- [ ] **T-ADP-02** 实现LLMAdapter适配器
  - **优先级**：P0
  - **所属模块**：fusion/adapters
  - **涉及文件**：`packages/core/src/fusion/adapters/llm-adapter.ts`（新建）
  - **预估行数**：80
  - **依赖任务**：T-ADP-01
  - **实现要点**：
    - 包装灵境LLM抽象层（config/schema.ts + config/defaults.ts）
    - 实现 `call(request: ChatRequest): AsyncIterable<StreamEvent>`，委托给LLM provider
    - 实现 `getModel()` 返回当前模型标识
    - 实现 `isAvailable(model)` 检查模型可用性
    - 降级：LLM服务不可用时返回错误提示

- [ ] **T-ADP-03** 实现MemoryAdapter适配器
  - **优先级**：P0
  - **所属模块**：fusion/adapters
  - **涉及文件**：`packages/core/src/fusion/adapters/memory-adapter.ts`（新建）
  - **预估行数**：60
  - **依赖任务**：T-ADP-01
  - **实现要点**：
    - 包装灵境SQLite记忆系统（update_memory工具）
    - 实现 `write(entry)` 写入结构化记忆
    - 实现 `query(filter)` 查询结构化记忆（category/scope/keyword过滤）

- [ ] **T-ADP-04** 实现SkillAdapter适配器
  - **优先级**：P0
  - **所属模块**：fusion/adapters
  - **涉及文件**：`packages/core/src/fusion/adapters/skill-adapter.ts`（新建）
  - **预估行数**：70
  - **依赖任务**：T-ADP-01
  - **实现要点**：
    - 包装灵境Skills系统（skills/loader.ts）
    - 实现 `register(skillDef)` 注册Skill定义
    - 实现 `load(skillId)` 加载Skill
    - 实现 `list()` 列出Skill目录

- [ ] **T-ADP-05** 实现ToolAdapter适配器
  - **优先级**：P0
  - **所属模块**：fusion/adapters
  - **涉及文件**：`packages/core/src/fusion/adapters/tool-adapter.ts`（新建）
  - **预估行数**：50
  - **依赖任务**：T-ADP-01
  - **实现要点**：
    - 包装灵境ToolRegistry（tools/registry.ts）
    - 实现 `register(tool)` 注册工具（增量注册）
    - 实现 `get(name)` 获取工具定义

- [ ] **T-ADP-06** 实现SchedulerAdapter适配器
  - **优先级**：P0
  - **所属模块**：fusion/adapters
  - **涉及文件**：`packages/core/src/fusion/adapters/scheduler-adapter.ts`（新建）
  - **预估行数**：70
  - **依赖任务**：T-ADP-01
  - **实现要点**：
    - 包装Cloud Server Scheduler
    - 实现 `register(cronExpr, task)` 注册定时任务
    - 实现 `cancel(scheduleId)` 取消任务
    - 实现 `list()` 列出已注册任务

### 1.4 数据库迁移 migration003

- [ ] **T-DB-01** 实现migration003数据库迁移（不含沙箱相关表）
  - **优先级**：P0
  - **所属模块**：fusion/database
  - **涉及文件**：`packages/electron/src/database/migrations/migration003_hermes_fusion.ts`（新建）
  - **预估行数**：250
  - **依赖任务**：T-ADP-01
  - **实现要点**：
    - 创建 `vector_memory` 表（id/memory_id/content/embedding/metadata/scope/project_path/category/score/encrypted/created_at/updated_at/deleted_at）+ 索引（scope+project_path、category、score DESC）
    - 创建 `execution_traces` 表（id/session_id/tool_name/parameters/result/duration_ms/importance/created_at）+ 索引（session_id、tool_name、importance DESC）
    - 创建 `skill_security_audit` 表（id/skill_path/skill_name/scan_result/risk_level/action_taken/scanner_ver/scanned_at）+ 索引（skill_name、risk_level、scanned_at DESC）
    - 创建 `dag_tasks` 表（id/dag_def/status/result/created_at/updated_at/completed_at）+ 索引（status、created_at DESC）
    - 创建 `dag_edges` 表（id/dag_id/node_id/status/result/started_at/completed_at/retry_count）+ 外键 + 索引（dag_id、status）
    - 创建 `model_routing_rules` 表（id/task_type/complexity/model/fallback_model/cost_budget/priority/enabled/created_at/updated_at）+ 索引（enabled、priority）
    - 创建 `model_routing_audit` 表（id/request_id/original_model/selected_model/matched_rule_id/reason/fallback/created_at）+ 索引（created_at DESC、selected_model）
    - 创建 `cron_schedules` 表（id/cron_expression/natural_language/task_type/task_config/next_run_at/last_run_at/run_count/enabled/created_at/updated_at）+ 索引（enabled、next_run_at）
    - 创建 `user_profiles` 表（id/coding_style/tech_stack/workflow_patterns/model_preferences/decision_history/reflection_summary/last_reflected_at/created_at/updated_at）
    - 创建 `fusion_config` 表（module_name/enabled/config_json/updated_at）+ 初始化12个模块默认配置（event_bus/hook_registry/sliding_window/vector_memory/review_engine/trace_harvester/skill_security/dag_orchestrator/multi_agent/model_router/nl_cron/user_modeler）
    - **不创建**沙箱相关表（sandbox_containers等）

---

## 批次2：核心增强层（P1）

### 2.1 SlidingWindowMemoryManager（REQ-H01）

- [ ] **T-H01-01** 实现SlidingWindowMemoryManager核心逻辑
  - **优先级**：P1
  - **所属模块**：fusion/sliding-window
  - **涉及文件**：`packages/core/src/fusion/sliding-window/types.ts`（新建）、`packages/core/src/fusion/sliding-window/sliding-window-manager.ts`（新建）
  - **预估行数**：180
  - **依赖任务**：T-H14-01, T-H15-01, T-ADP-03
  - **实现要点**：
    - 定义 `SlidingWindowConfig`（enabled/windowUpperLimit=120000/windowLowerLimit=80000/preserveRecentN=10/importanceWeight=0.3/recencyWeight=0.7）
    - 定义 `CompactResult`（retainedMessages/evictedMessages/evictedTokenCount/retainedTokenCount）
    - 定义 `ISlidingWindowMemoryManager` 接口（initialize/compactWithSlidingWindow/healthCheck/degrade）
    - 实现 `compactWithSlidingWindow`：tokenCount > windowUpperLimit时 → 计算importanceScore（importance*importanceWeight + recency*recencyWeight） → 标记最近preserveRecentN条不可淘汰 → 按score升序选择淘汰候选 → 淘汰至tokenCount <= windowLowerLimit → 发布memory:window_compacted事件
    - 初始化：注册after_compaction Hook

- [ ] **T-H01-02** 实现降级策略与单元测试
  - **优先级**：P1
  - **所属模块**：fusion/sliding-window
  - **涉及文件**：`packages/core/src/fusion/sliding-window/sliding-window-manager.ts`（修改）、`packages/core/src/fusion/sliding-window/__tests__/sliding-window.test.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H01-01
  - **实现要点**：
    - degrade()方法：回退到原有auto-compaction策略
    - 初始化失败时自动降级
    - 测试：窗口淘汰基本功能、preserveRecentN保护、降级行为、事件发布

### 2.2 VectorMemoryStore（REQ-H02）

- [ ] **T-H02-01** 实现VectorMemoryStore核心逻辑
  - **优先级**：P1
  - **所属模块**：fusion/vector-memory
  - **涉及文件**：`packages/core/src/fusion/vector-memory/types.ts`（新建）、`packages/core/src/fusion/vector-memory/vector-memory-store.ts`（新建）
  - **预估行数**：200
  - **依赖任务**：T-H14-01, T-DB-01
  - **实现要点**：
    - 定义 `VectorMemoryConfig`（enabled/adapter='sqlite-vss'|'faiss'/embeddingModel/embeddingDimension=1536/defaultTopK=5/encryptionEnabled=true）
    - 定义 `VectorSearchResult`（id/content/score/metadata）
    - 定义 `IVectorStoreAdapter`（upsert/search/delete/initialize）和 `IVectorMemoryStore` 接口
    - 实现store方法：embeddingFn(content) → 加密metadata（若启用）→ adapter.upsert → 发布vector:synced
    - 实现search方法：embeddingFn(query) → adapter.search(queryVector, topK) → 返回结果
    - 实现syncFromMemory：订阅memory:updated事件，自动同步新记忆到向量索引
    - 实现delete方法

- [ ] **T-H02-02** 实现VectorStoreAdapter（sqlite-vss适配器）
  - **优先级**：P1
  - **所属模块**：fusion/vector-memory
  - **涉及文件**：`packages/core/src/fusion/vector-memory/adapters/sqlite-vss-adapter.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H02-01
  - **实现要点**：
    - 实现IVectorStoreAdapter接口
    - upsert：写入vector_memory表 + vss虚拟表
    - search：向量相似度检索
    - 初始化：创建vss虚拟表（若不存在）

- [ ] **T-H02-03** 注册remember_vector/recall_vector工具与测试
  - **优先级**：P1
  - **所属模块**：fusion/vector-memory
  - **涉及文件**：`packages/core/src/fusion/vector-memory/tools/remember-vector.ts`（新建）、`packages/core/src/fusion/vector-memory/tools/recall-vector.ts`（新建）、`packages/core/src/fusion/vector-memory/__tests__/vector-memory.test.ts`（新建）
  - **预估行数**：150
  - **依赖任务**：T-H02-02, T-ADP-05
  - **实现要点**：
    - 实现 `remember_vector` 工具：接收content+metadata → store
    - 实现 `recall_vector` 工具：接收query+topK → search
    - 通过ToolAdapter注册到ToolRegistry
    - 测试：存储/检索/同步/降级（向量数据库不可用）

### 2.3 NudgeReviewEngine（REQ-H03）

- [ ] **T-H03-01** 实现NudgeReviewEngine核心逻辑
  - **优先级**：P1
  - **所属模块**：fusion/review-engine
  - **涉及文件**：`packages/core/src/fusion/review-engine/types.ts`（新建）、`packages/core/src/fusion/review-engine/nudge-review-engine.ts`（新建）
  - **预估行数**：160
  - **依赖任务**：T-H14-01, T-ADP-02
  - **实现要点**：
    - 定义 `ReviewConfig`（enabled/reviewModel/maxLLMConcurrency=1/reviewTimeout=30000/scoreThreshold=7.0）
    - 定义 `ReviewReport`（reviewId/originalMessageId/score/suggestions/riskFlags/reviewedAt/label='审查建议'）
    - 定义 `INudgeReviewEngine` 接口（initialize/startReview/healthCheck）
    - 实现ReviewAgent：独立Agent实例，使用LLMAdapter调用审查模型
    - startReview：检查LLM并发配额（≤1）→ 启动ReviewAgent → 生成ReviewReport → 发布review:completed
    - 订阅agent:message_end事件触发审查
    - 审查失败/超时：发布review:failed，静默降级

- [ ] **T-H03-02** 实现LLM配额管理与测试
  - **优先级**：P1
  - **所属模块**：fusion/review-engine
  - **涉及文件**：`packages/core/src/fusion/review-engine/llm-quota-manager.ts`（新建）、`packages/core/src/fusion/review-engine/__tests__/review-engine.test.ts`（新建）
  - **预估行数**：100
  - **依赖任务**：T-H03-01
  - **实现要点**：
    - 实现 `LLMQuotaManager`：并发配额控制，最多占1个LLM配额
    - 配额不足时排队等待
    - 测试：审查基本流程、配额限制、超时降级、事件发布

### 2.4 SkillSecurityLoader（REQ-H05）

- [ ] **T-H05-01** 实现SecurityScanner安全扫描器
  - **优先级**：P1
  - **所属模块**：fusion/skill-security
  - **涉及文件**：`packages/core/src/fusion/skill-security/types.ts`（新建）、`packages/core/src/fusion/skill-security/security-scanner.ts`（新建）
  - **预估行数**：200
  - **依赖任务**：T-H15-01
  - **实现要点**：
    - 定义 `SecurityConfig`（enabled/blockOnHighRisk=true/warnOnMediumRisk=true/scanRules）
    - 定义 `SecurityRisk` 联合类型（command_injection/path_traversal/privilege_escalation/data_leakage）
    - 定义 `SecurityFinding`（type/severity/description/location）、`SecurityScanResult`（skillPath/findings/riskLevel/allowed）
    - 实现4类安全检查：
      - checkCommandInjection：检测shell命令注入模式
      - checkPathTraversal：检测路径遍历攻击模式
      - checkPrivilegeEscalation：检测权限提升操作
      - checkDataLeakage：检测敏感数据泄露
    - scan方法：执行4类检查 → 汇总findings → 计算riskLevel

- [ ] **T-H05-02** 实现ProgressiveLoader渐进式加载与SkillSecurityLoader组合
  - **优先级**：P1
  - **所属模块**：fusion/skill-security
  - **涉及文件**：`packages/core/src/fusion/skill-security/progressive-loader.ts`（新建）、`packages/core/src/fusion/skill-security/skill-security-loader.ts`（新建）
  - **预估行数**：150
  - **依赖任务**：T-H05-01, T-H14-01, T-ADP-04
  - **实现要点**：
    - ProgressiveLoader：loadMetadata仅加载元数据 → loadFullContent按需加载完整定义 → 内部维护loadedSkills状态Map
    - SkillSecurityLoader组合：scanAndLoad → SecurityScanner.scan → 高风险阻止（发布skill:blocked）→ 中低风险标记受限 → 通过扫描则ProgressiveLoader.loadMetadata → 调用时loadFullContent
    - 注册before_skill_load Hook

- [ ] **T-H05-03** 实现SkillSecurityLoader测试
  - **优先级**：P1
  - **所属模块**：fusion/skill-security
  - **涉及文件**：`packages/core/src/fusion/skill-security/__tests__/skill-security.test.ts`（新建）
  - **预估行数**：100
  - **依赖任务**：T-H05-02
  - **实现要点**：
    - 测试4类安全检查
    - 测试高风险阻止加载
    - 测试中低风险标记受限
    - 测试渐进加载（先元数据后完整内容）
    - 测试skill:blocked事件发布
    - 测试禁用时回退原有流程

### 2.5 ExecutionTraceHarvester（REQ-H04）

- [ ] **T-H04-01** 实现ExecutionTraceHarvester核心逻辑
  - **优先级**：P1
  - **所属模块**：fusion/trace-harvester
  - **涉及文件**：`packages/core/src/fusion/trace-harvester/types.ts`（新建）、`packages/core/src/fusion/trace-harvester/execution-trace-harvester.ts`（新建）
  - **预估行数**：180
  - **依赖任务**：T-H14-01, T-ADP-04
  - **实现要点**：
    - 定义 `TraceHarvesterConfig`（enabled/minToolCalls=3/minTraceDuration=30000）
    - 定义 `ExecutionTrace`（sessionId/toolCallSequence/startTime/endTime/totalSteps）、`ToolCallStep`（toolName/parameters/result/duration/timestamp）、`WorkflowPattern`
    - 定义 `IExecutionTraceHarvester` 接口
    - collectTrace：订阅agent:tool_call + agent:tool_result → 收集ToolCallStep到traceBuffer
    - analyzeAndGenerateSkill：对话轮次结束 → traceBuffer.length >= minToolCalls → extractWorkflowPattern → 使用LLM生成SKILL.md（level='auto-generated'） → skillAdapter.register
    - 轨迹分析失败静默跳过

- [ ] **T-H04-02** 实现工作流模式提取与测试
  - **优先级**：P1
  - **所属模块**：fusion/trace-harvester
  - **涉及文件**：`packages/core/src/fusion/trace-harvester/execution-trace-harvester.ts`（修改）、`packages/core/src/fusion/trace-harvester/__tests__/trace-harvester.test.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H04-01
  - **实现要点**：
    - extractWorkflowPattern：分析工具调用序列 → 识别重复模式 → 提取可复用工作流
    - 测试：轨迹收集、模式提取、Skill生成注册、不足3步跳过、禁用时仅对话分析

---

## 批次3：智能增强层（P2）

### 3.1 DAGOrchestrator（REQ-H06）

- [ ] **T-H06-01** 实现DAGOrchestrator核心逻辑
  - **优先级**：P2
  - **所属模块**：fusion/dag-orchestrator
  - **涉及文件**：`packages/core/src/fusion/dag-orchestrator/types.ts`（新建）、`packages/core/src/fusion/dag-orchestrator/dag-orchestrator.ts`（新建）
  - **预估行数**：250
  - **依赖任务**：T-H14-01, T-H07-01
  - **实现要点**：
    - 定义 `DAGDefinition`（id/nodes/edges/maxConcurrency=4/retryPolicy）、`DAGNode`（taskId/taskDef/dependencies/condition?）、`DAGEdge`（from/to/condition?）、`RetryPolicy`（maxRetries=3/retryDelay=1000）
    - 定义 `ExecutionPlan`（layers/nodeStatus）、`DAGResult`（dagId/nodeResults/failedNodes/totalTime/status）
    - 定义 `IDAGOrchestrator` 接口
    - validateDAG：DFS拓扑排序检测环路
    - buildExecutionPlan：拓扑分层
    - execute：验证 → 分层 → 逐层执行 → scheduleReadyNodes → 并行执行ready节点（≤maxConcurrency） → 条件分支评估 → 收集结果 → 失败节点+下游标记 → 支持从失败节点重试 → 发布dag:completed/dag:failed
    - 注册dag_execute工具

- [ ] **T-H06-02** 实现DAG重试恢复与测试
  - **优先级**：P2
  - **所属模块**：fusion/dag-orchestrator
  - **涉及文件**：`packages/core/src/fusion/dag-orchestrator/dag-orchestrator.ts`（修改）、`packages/core/src/fusion/dag-orchestrator/__tests__/dag-orchestrator.test.ts`（新建）
  - **预估行数**：150
  - **依赖任务**：T-H06-01
  - **实现要点**：
    - 失败节点重试逻辑：标记失败节点 → 重新执行失败节点 → 继续执行下游
    - 条件分支：根据上游输出评估BranchCondition
    - 测试：DAG验证（环路检测）、拓扑执行、并行执行、条件分支、失败重试、事件发布

### 3.2 MultiAgentExecutor（REQ-H07）

- [ ] **T-H07-01** 实现MultiAgentExecutor核心逻辑
  - **优先级**：P2
  - **所属模块**：fusion/multi-agent
  - **涉及文件**：`packages/core/src/fusion/multi-agent/types.ts`（新建）、`packages/core/src/fusion/multi-agent/multi-agent-executor.ts`（新建）
  - **预估行数**：200
  - **依赖任务**：T-H14-01
  - **实现要点**：
    - 定义 `MultiAgentConfig`（enabled/maxConcurrency=4/taskTimeout=120000/degradeToSequential=true）
    - 定义 `ParallelTask`（taskId/prompt/tools?/model?）、`ParallelResult`（results/failedTasks/timedOutTasks/totalTime）
    - 定义 `IMultiAgentExecutor` 接口
    - AgentFactory：create(AgentConfig)创建Agent实例 → destroy释放资源
    - execute：任务数 > maxConcurrency时分批 → 每批Promise.allSettled并行 → 超时终止 → 收集结果 → 释放资源 → 配额不足降级串行 → 发布parallel:completed
    - 注册parallel_execute工具

- [ ] **T-H07-02** 实现MultiAgentExecutor测试
  - **优先级**：P2
  - **所属模块**：fusion/multi-agent
  - **涉及文件**：`packages/core/src/fusion/multi-agent/__tests__/multi-agent.test.ts`（新建）
  - **预估行数**：100
  - **依赖任务**：T-H07-01
  - **实现要点**：
    - 测试：并行执行基本功能、并发数限制、超时终止、资源释放、降级串行、事件发布

### 3.3 DynamicModelRouter（REQ-H08）

- [ ] **T-H08-01** 实现DynamicModelRouter核心逻辑
  - **优先级**：P2
  - **所属模块**：fusion/model-router
  - **涉及文件**：`packages/core/src/fusion/model-router/types.ts`（新建）、`packages/core/src/fusion/model-router/dynamic-model-router.ts`（新建）
  - **预估行数**：200
  - **依赖任务**：T-H15-01, T-H14-01, T-ADP-02
  - **实现要点**：
    - 定义 `ModelRouterConfig`（enabled/defaultModel/auditLogEnabled=true）
    - 定义 `RouteRule`（id/taskType/complexity?/model/costBudget?/fallbackModel?/priority/enabled）
    - 定义 `TaskFeatures`（taskType/complexity/contextLength/hasToolCalls/estimatedCost）、`RoutingDecision`（requestId/originalModel/selectedModel/matchedRule/reason/timestamp）
    - 定义 `IDynamicModelRouter` 接口
    - evaluateTaskFeatures：分析请求特征（taskType/complexity/contextLength等）
    - matchRule：按priority遍历rules匹配taskType+complexity
    - route：before_llm_call Hook触发 → evaluateTaskFeatures → matchRule → selectModel → 检查可用性 → 不可用降级到fallbackModel（发布model:fallback） → 替换request模型 → 记录RoutingDecision审计日志
    - addRule/removeRule动态管理规则

- [ ] **T-H08-02** 实现路由审计日志与测试
  - **优先级**：P2
  - **所属模块**：fusion/model-router
  - **涉及文件**：`packages/core/src/fusion/model-router/dynamic-model-router.ts`（修改）、`packages/core/src/fusion/model-router/__tests__/model-router.test.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H08-01, T-DB-01
  - **实现要点**：
    - RoutingDecision写入model_routing_audit表
    - 测试：路由规则匹配、复杂度评估、模型降级回退、审计日志记录、禁用时默认模型

### 3.4 HonchoUserModeler（REQ-H10）

- [ ] **T-H10-01** 实现HonchoUserModeler核心逻辑
  - **优先级**：P2
  - **所属模块**：fusion/user-modeler
  - **涉及文件**：`packages/core/src/fusion/user-modeler/types.ts`（新建）、`packages/core/src/fusion/user-modeler/honcho-user-modeler.ts`（新建）
  - **预估行数**：160
  - **依赖任务**：T-H14-01, T-H02-01, T-ADP-03
  - **实现要点**：
    - 定义 `UserProfile`（id/codingStyle/techStack/workflowPatterns/modelPreferences/decisionHistory/lastUpdated）、`UserModelerConfig`（enabled/persistInterval=60000）
    - 定义 `IHonchoUserModeler` 接口
    - updateUserModel：mergeIncremental合并增量到currentModel → vectorStore.store向量索引 → 写入user_profiles表 → 发布user_model:updated
    - 订阅MemoryReflector输出（通过事件拦截）
    - getCurrentModel返回当前用户模型
    - 定时持久化（persistInterval）

- [ ] **T-H10-02** 实现增量合并与测试
  - **优先级**：P2
  - **所属模块**：fusion/user-modeler
  - **涉及文件**：`packages/core/src/fusion/user-modeler/honcho-user-modeler.ts`（修改）、`packages/core/src/fusion/user-modeler/__tests__/user-modeler.test.ts`（新建）
  - **预估行数**：100
  - **依赖任务**：T-H10-01
  - **实现要点**：
    - mergeIncremental：智能合并增量（去重、权重衰减）
    - 测试：模型更新、增量合并、事件发布、向量索引、降级（事件发布失败）

---

## 批次4：高级编排与扩展层（P3）

### 4.1 NLCronScheduler（REQ-H09）

- [ ] **T-H09-01** 实现NLCronScheduler核心逻辑
  - **优先级**：P3
  - **所属模块**：fusion/nl-cron
  - **涉及文件**：`packages/core/src/fusion/nl-cron/types.ts`（新建）、`packages/core/src/fusion/nl-cron/nl-cron-scheduler.ts`（新建）、`packages/core/src/fusion/nl-cron/nl-to-cron-converter.ts`（新建）
  - **预估行数**：180
  - **依赖任务**：T-H14-01, T-ADP-06
  - **实现要点**：
    - 定义 `NLCronConfig`（enabled/conversionModel）、`CronSchedule`（id/cronExpression/naturalLanguage/task/nextRunAt/enabled）、`ScheduleResult`（scheduleId/cronExpression/success/error?）
    - 定义 `INLCronScheduler` 接口
    - NLToCronConverter：LLM将自然语言转换为Cron表达式 → 验证Cron表达式有效性
    - scheduleFromNL：NLToCronConverter.convert → 验证 → schedulerAdapter.register → 写入cron_schedules表 → 发布cron:registered
    - listSchedules/cancelSchedule管理调度
    - NL转换失败返回解析错误+示例格式提示

- [ ] **T-H09-02** 实现NLCronScheduler测试
  - **优先级**：P3
  - **所属模块**：fusion/nl-cron
  - **涉及文件**：`packages/core/src/fusion/nl-cron/__tests__/nl-cron.test.ts`（新建）
  - **预估行数**：80
  - **依赖任务**：T-H09-01
  - **实现要点**：
    - 测试：NL→Cron转换、Cron验证、任务注册/取消、预览、转换失败提示、禁用时仅标准Cron

### 4.2 Renderer UI组件

- [ ] **T-UI-01** 实现VectorMemoryPanel向量记忆面板
  - **优先级**：P3
  - **所属模块**：fusion/ui
  - **涉及文件**：`packages/renderer/src/components/fusion/VectorMemoryPanel.vue`（新建）、`packages/renderer/src/stores/fusion/useVectorMemoryStore.ts`（新建）
  - **预估行数**：180
  - **依赖任务**：T-H02-01
  - **实现要点**：
    - Store：封装fusion:vector:search/status/delete/sync IPC调用
    - 组件：向量记忆列表展示、语义搜索输入框、同步状态指示、记忆详情预览、删除操作

- [ ] **T-UI-02** 实现DAGCanvas DAG编排画布
  - **优先级**：P3
  - **所属模块**：fusion/ui
  - **涉及文件**：`packages/renderer/src/components/fusion/DAGCanvas.vue`（新建）、`packages/renderer/src/stores/fusion/useDAGStore.ts`（新建）
  - **预估行数**：250
  - **依赖任务**：T-H06-01
  - **实现要点**：
    - Store：封装fusion:dag:execute/status/retry/cancel IPC调用
    - 组件：可视化DAG节点和边、拖拽编排、执行状态实时更新（pending/running/completed/failed）、失败节点重试按钮

- [ ] **T-UI-03** 实现MultiAgentPanel多Agent状态面板
  - **优先级**：P3
  - **所属模块**：fusion/ui
  - **涉及文件**：`packages/renderer/src/components/fusion/MultiAgentPanel.vue`（新建）、`packages/renderer/src/stores/fusion/useMultiAgentStore.ts`（新建）
  - **预估行数**：150
  - **依赖任务**：T-H07-01
  - **实现要点**：
    - Store：封装fusion:parallel:execute/status IPC调用
    - 组件：并行Agent实例列表、各Agent状态（运行/完成/超时/失败）、结果汇总

- [ ] **T-UI-04** 实现ModelRouterConfig模型路由配置
  - **优先级**：P3
  - **所属模块**：fusion/ui
  - **涉及文件**：`packages/renderer/src/components/fusion/ModelRouterConfig.vue`（新建）、`packages/renderer/src/stores/fusion/useModelRouterStore.ts`（新建）
  - **预估行数**：180
  - **依赖任务**：T-H08-01
  - **实现要点**：
    - Store：封装fusion:router:rules/addRule/removeRule/audit/status IPC调用
    - 组件：路由规则CRUD、审计日志查看、规则优先级拖拽排序、模型可用性检测

- [ ] **T-UI-05** 实现CronScheduleManager Cron调度管理
  - **优先级**：P3
  - **所属模块**：fusion/ui
  - **涉及文件**：`packages/renderer/src/components/fusion/CronScheduleManager.vue`（新建）、`packages/renderer/src/stores/fusion/useCronStore.ts`（新建）
  - **预估行数**：150
  - **依赖任务**：T-H09-01
  - **实现要点**：
    - Store：封装fusion:cron:schedule/list/cancel/preview IPC调用
    - 组件：自然语言输入框、Cron表达式预览、调度列表管理、执行历史

- [ ] **T-UI-06** 实现ReviewReportPanel审查报告面板
  - **优先级**：P3
  - **所属模块**：fusion/ui
  - **涉及文件**：`packages/renderer/src/components/fusion/ReviewReportPanel.vue`（新建）、`packages/renderer/src/stores/fusion/useReviewStore.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H03-01
  - **实现要点**：
    - Store：封装fusion:review:reports/status IPC调用
    - 组件：审查报告列表、评分可视化（0-10）、建议详情、风险标记

- [ ] **T-UI-07** 实现UserProfilePanel用户画像面板
  - **优先级**：P3
  - **所属模块**：fusion/ui
  - **涉及文件**：`packages/renderer/src/components/fusion/UserProfilePanel.vue`（新建）、`packages/renderer/src/stores/fusion/useUserModelStore.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H10-01
  - **实现要点**：
    - Store：封装fusion:usermodel:profile/trigger/status IPC调用
    - 组件：用户偏好展示、编码风格/技术栈/工作流模式标签云、手动触发更新

- [ ] **T-UI-08** 实现FusionSettings融合层全局设置
  - **优先级**：P3
  - **所属模块**：fusion/ui
  - **涉及文件**：`packages/renderer/src/components/fusion/FusionSettings.vue`（新建）、`packages/renderer/src/stores/fusion/useFusionStore.ts`（新建）
  - **预估行数**：150
  - **依赖任务**：T-UI-01~T-UI-07
  - **实现要点**：
    - Store：封装fusion:health:check/config:get/config:set/module:toggle IPC调用
    - 组件：各增强模块启用/禁用开关、健康状态指示灯、降级/熔断状态、全局配置面板

### 4.3 IPC注册集成

- [ ] **T-IPC-01** 实现EventBus IPC通道注册
  - **优先级**：P3
  - **所属模块**：fusion/ipc
  - **涉及文件**：`packages/electron/src/ipc/fusion/eventbus-ipc.ts`（新建）
  - **预估行数**：60
  - **依赖任务**：T-H14-01
  - **实现要点**：
    - 注册 `fusion:eventbus:publish`、`fusion:eventbus:subscribe`、`fusion:eventbus:metrics` IPC通道
    - ipcMain.handle桥接Core层EventBus方法

- [ ] **T-IPC-02** 实现HookRegistry IPC通道注册
  - **优先级**：P3
  - **所属模块**：fusion/ipc
  - **涉及文件**：`packages/electron/src/ipc/fusion/hook-ipc.ts`（新建）
  - **预估行数**：40
  - **依赖任务**：T-H15-01
  - **实现要点**：
    - 注册 `fusion:hook:list`、`fusion:hook:unregister` IPC通道

- [ ] **T-IPC-03** 实现增强模块IPC通道注册（批量）
  - **优先级**：P3
  - **所属模块**：fusion/ipc
  - **涉及文件**：`packages/electron/src/ipc/fusion/memory-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/vector-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/review-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/trace-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/skill-security-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/dag-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/multi-agent-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/model-router-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/cron-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/user-model-ipc.ts`（新建）、`packages/electron/src/ipc/fusion/fusion-global-ipc.ts`（新建）
  - **预估行数**：300
  - **依赖任务**：T-H01-01, T-H02-01, T-H03-01, T-H04-01, T-H05-01, T-H06-01, T-H07-01, T-H08-01, T-H09-01, T-H10-01
  - **实现要点**：
    - SlidingWindowMemory：`fusion:memory:window:config`、`fusion:memory:window:status`
    - VectorMemory：`fusion:vector:store`、`fusion:vector:search`、`fusion:vector:delete`、`fusion:vector:sync`、`fusion:vector:status`
    - ReviewEngine：`fusion:review:config`、`fusion:review:reports`、`fusion:review:status`
    - TraceHarvester：`fusion:trace:config`、`fusion:trace:history`、`fusion:trace:skills`
    - SkillSecurity：`fusion:skill:scan`、`fusion:skill:audit`、`fusion:skill:blocked`
    - DAG：`fusion:dag:execute`、`fusion:dag:status`、`fusion:dag:retry`、`fusion:dag:cancel`
    - MultiAgent：`fusion:parallel:execute`、`fusion:parallel:status`
    - ModelRouter：`fusion:router:rules`、`fusion:router:addRule`、`fusion:router:removeRule`、`fusion:router:audit`、`fusion:router:status`
    - Cron：`fusion:cron:schedule`、`fusion:cron:list`、`fusion:cron:cancel`、`fusion:cron:preview`
    - UserModel：`fusion:usermodel:profile`、`fusion:usermodel:trigger`、`fusion:usermodel:status`
    - FusionGlobal：`fusion:health:check`、`fusion:config:get`、`fusion:config:set`、`fusion:module:toggle`

- [ ] **T-IPC-04** 实现IPC注册入口与Electron集成
  - **优先级**：P3
  - **所属模块**：fusion/ipc
  - **涉及文件**：`packages/electron/src/ipc/fusion/index.ts`（新建）、`packages/electron/src/ipc/fusion/register.ts`（新建）
  - **预估行数**：60
  - **依赖任务**：T-IPC-01, T-IPC-02, T-IPC-03
  - **实现要点**：
    - 统一导出所有融合层IPC注册函数
    - registerFusionIPC(mainWindow)函数：按序注册所有IPC通道
    - 在Electron主进程初始化时调用registerFusionIPC

### 4.4 ConnectorHub扩展接口（REQ-H12）

- [ ] **T-H12-01** 实现ConnectorHub扩展适配器
  - **优先级**：P3
  - **所属模块**：fusion/connectors
  - **涉及文件**：`packages/core/src/fusion/connectors/connector-hub-adapter.ts`（新建）、`packages/core/src/fusion/connectors/types.ts`（新建）
  - **预估行数**：80
  - **依赖任务**：T-H14-01
  - **实现要点**：
    - 定义 `ConnectorHubAdapter` 接口（register/discover/invoke）
    - 包装ConnectorHub标准注册和发现接口
    - 不修改ConnectorHub源码
    - 融合模块通过适配器注册和发现连接器

### 4.5 跨平台消息网关增强（REQ-H11）

- [ ] **T-H11-01** 实现统一消息网关抽象层
  - **优先级**：P3
  - **所属模块**：fusion/gateway
  - **涉及文件**：`packages/core/src/fusion/gateway/types.ts`（新建）、`packages/core/src/fusion/gateway/message-gateway.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H12-01, T-H14-01
  - **实现要点**：
    - 定义统一消息格式（UnifiedMessage）：platform/sender/content/timestamp/metadata
    - 定义 `IMessageGateway` 接口（registerPlatform/sendMessage/receiveMessage）
    - 各平台连接器实现统一接口（Discord、Slack等）
    - 平台消息→统一格式→Agent处理→统一格式→平台格式→发送回复
    - 平台初始化失败标记不可用，不影响其他平台

### 4.6 熔断器与融合层初始化

- [ ] **T-CB-01** 实现CircuitBreaker熔断器
  - **优先级**：P3
  - **所属模块**：fusion/common
  - **涉及文件**：`packages/core/src/fusion/circuit-breaker.ts`（新建）
  - **预估行数**：60
  - **依赖任务**：T-H14-01
  - **实现要点**：
    - CircuitBreakerConfig（failureThreshold=3/resetTimeout=60000）
    - 状态机：closed → open（连续3次异常）→ half-open（resetTimeout后尝试）→ closed（成功）
    - execute方法：检查状态 → 执行函数 → 成功/失败回调

- [ ] **T-INIT-01** 实现融合层统一初始化与模块管理
  - **优先级**：P3
  - **所属模块**：fusion
  - **涉及文件**：`packages/core/src/fusion/fusion-initializer.ts`（新建）、`packages/core/src/fusion/types.ts`（新建）
  - **预估行数**：120
  - **依赖任务**：T-H14-01, T-H15-01, T-DB-01, T-CB-01
  - **实现要点**：
    - FusionConfig：各模块enabled开关 + 配置项
    - FusionInitializer.initialize()：按P0→P1→P2→P3顺序初始化 → 检查依赖条件 → 初始化失败模块降级 → 总初始化时间≤500ms
    - 模块管理：toggle启用/禁用 → healthCheck → 熔断检测
    - 回滚保障：模块禁用后行为与融合前一致

### 4.7 融合测试与兼容性验证

- [ ] **T-TEST-01** 融合层集成测试
  - **优先级**：P3
  - **所属模块**：fusion/testing
  - **涉及文件**：`packages/core/src/fusion/__tests__/integration/fusion-integration.test.ts`（新建）
  - **预估行数**：200
  - **依赖任务**：T-INIT-01, T-IPC-04
  - **实现要点**：
    - 测试EventBus + HookRegistry联合运行
    - 测试完整事件流：agent:message_end → NudgeReviewEngine → review:completed
    - 测试Hook链式执行：before_llm_call → DynamicModelRouter → 模型替换
    - 测试DAG + MultiAgentExecutor联合编排
    - 测试模块间事件驱动通信
    - 测试融合层初始化（≤500ms）

- [ ] **T-TEST-02** 兼容性与降级验证测试
  - **优先级**：P3
  - **所属模块**：fusion/testing
  - **涉及文件**：`packages/core/src/fusion/__tests__/integration/compatibility.test.ts`（新建）
  - **预估行数**：150
  - **依赖任务**：T-TEST-01
  - **实现要点**：
    - 验证：所有融合模块禁用时，灵境行为与融合前完全一致
    - 验证：单一模块异常不导致主Agent循环中断
    - 验证：CircuitBreaker熔断后模块降级
    - 验证：fusion_config表模块启用/禁用即时生效
    - 验证：IPC通道不与已有通道冲突
    - 验证：migration003为纯增量DDL，不影响已有表

- [ ] **T-TEST-03** 性能约束验证测试
  - **优先级**：P3
  - **所属模块**：fusion/testing
  - **涉及文件**：`packages/core/src/fusion/__tests__/integration/performance.test.ts`（新建）
  - **预估行数**：100
  - **依赖任务**：T-TEST-01
  - **实现要点**：
    - 验证：融合层初始化≤500ms
    - 验证：EventBus事件投递延迟≤10ms（P99）
    - 验证：Hook回调执行≤100ms（P99）
    - 验证：向量检索响应≤200ms（P99）
    - 验证：EventBus吞吐≥1000事件/秒
    - 验证：MultiAgentExecutor并发≤4个

---

## 任务统计

| 批次 | 优先级 | 任务组 | 任务数 | 预估总行数 |
|------|--------|--------|--------|-----------|
| 批次1 | P0 | EventBus | 3 | 430 |
| 批次1 | P0 | HookRegistry | 3 | 360 |
| 批次1 | P0 | 适配器基础框架 | 6 | 430 |
| 批次1 | P0 | migration003 | 1 | 250 |
| 批次2 | P1 | SlidingWindowMemoryManager | 2 | 300 |
| 批次2 | P1 | VectorMemoryStore | 3 | 470 |
| 批次2 | P1 | NudgeReviewEngine | 2 | 260 |
| 批次2 | P1 | SkillSecurityLoader | 3 | 450 |
| 批次2 | P1 | ExecutionTraceHarvester | 2 | 300 |
| 批次3 | P2 | DAGOrchestrator | 2 | 400 |
| 批次3 | P2 | MultiAgentExecutor | 2 | 300 |
| 批次3 | P2 | DynamicModelRouter | 2 | 320 |
| 批次3 | P2 | HonchoUserModeler | 2 | 260 |
| 批次4 | P3 | NLCronScheduler | 2 | 260 |
| 批次4 | P3 | Renderer UI组件 | 8 | 1200 |
| 批次4 | P3 | IPC注册集成 | 4 | 460 |
| 批次4 | P3 | ConnectorHub扩展 | 1 | 80 |
| 批次4 | P3 | 消息网关增强 | 1 | 120 |
| 批次4 | P3 | 熔断器与初始化 | 2 | 180 |
| 批次4 | P3 | 融合测试与验证 | 3 | 450 |
| **合计** | - | - | **54** | **~6530** |

## 需求覆盖矩阵

| 需求编号 | 需求名称 | 对应任务 | 优先级 |
|---------|---------|---------|--------|
| REQ-H01 | 滑动窗口短期记忆增强 | T-H01-01, T-H01-02 | P1 |
| REQ-H02 | 向量长期记忆 | T-H02-01, T-H02-02, T-H02-03 | P1 |
| REQ-H03 | Nudge后台审查引擎 | T-H03-01, T-H03-02 | P1 |
| REQ-H04 | 执行轨迹自动技能生成 | T-H04-01, T-H04-02 | P1 |
| REQ-H05 | Skill安全修补与渐进式加载 | T-H05-01, T-H05-02, T-H05-03 | P1 |
| REQ-H06 | DAG任务编排 | T-H06-01, T-H06-02 | P2 |
| REQ-H07 | 多Agent并行执行器 | T-H07-01, T-H07-02 | P2 |
| REQ-H08 | 动态模型路由 | T-H08-01, T-H08-02 | P2 |
| REQ-H09 | 自然语言Cron调度 | T-H09-01, T-H09-02 | P3 |
| REQ-H10 | Honcho用户建模增强 | T-H10-01, T-H10-02 | P2 |
| REQ-H11 | 跨平台消息网关增强 | T-H11-01 | P3 |
| REQ-H12 | ConnectorHub扩展接口 | T-H12-01 | P3 |
| REQ-H14 | 事件总线基础设施 | T-H14-01, T-H14-02, T-H14-03 | P0 |
| REQ-H15 | Hook机制基础设施 | T-H15-01, T-H15-02, T-H15-03 | P0 |
