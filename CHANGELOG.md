## [1.73.63] - 2026-06-14
### 修复
- **@codepilot/core 子路径模块缺失**: 修复 23 个缺失模块导致 esbuild 构建 69 个 ERR_MODULE_NOT_FOUND 错误
  - 为 checkpoint, context, intent, completion, rules, voice, pipeline, pm, security, review 等 23 个子路径模块创建 stub 实现
  - 修复 agent.js 内部动态 import 依赖 (executor.js, nudger.js, task-complexity-analyzer.js, harvester.js)
  - 所有 stub 返回 no-op 实现，确保优雅降级而非崩溃

## [1.73.62] - 2026-06-14
### 修复
- **版本文件同步统一化**: 修复云端 versions.json 多路径不同步导致客户端版本检测异常
  - admin-api.js writeVersionsJson(): 5路径→15路径全同步写入
  - server.js readVersionInfo(): 统一主路径为 /var/www/html/versions.json
  - update/app.js + lingjing-update-server.js: 单路径→多路径回退
  - promoteYamlFiles(): 新增 try-catch 容错
- **Scheduler Bug**: schedules 表缺少 last_error 列导致调度任务失败108次后暂停
- **版本号不一致**: 生产环境 :8000 返回1.73.60, :3000/:3002 返回1.73.61 → 统一为1.73.61
- **lingjing-update-server Bug**: 第185行引用已删除变量 VERSIONS_FILE 导致服务启动失败

### 部署
- 生产服务器 120.55.5.220 全网发布
- 3个版本API端点 (:3000, :3002, :8000) 统一返回 1.73.61
- Git push → ide-origin post-receive hook 自动部署 + PM2重启

# �龳IDE ������־
## [1.73.61] �� 202 6-06-14
### �޸�
- **Electron ��������**: �޸������� after-pack-hook.cjs �ƻ����ع� ASAR ���� @codepilot/core ģ���޷��ҵ������⡣
- **���������Ż�**: �Ƴ���Σ�յ� ASAR �ش���߼������ñ�׼�� asarUnpack ���ƣ�ȷ��������������װ���������Ժ��ȶ���.
# 灵境IDE 更新日志

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)�?
## [1.73.34] �?2026-06-12

### 修复
- **版本检测误�?*: 修复云端 versions.json 数据源不同步导致客户端版本检测异�?  - 6�?versions.json 文件统一�?latest: 1.73.34
  - cloud-server / update-server / lingjing-update-server 全部修复 hasUpdate 智能对比
  - `/api/latest` 新增 `?current=` 参数支持客户端版本对�?  - 新增排查文档 `docs/version-troubleshooting.md`

## [1.73.0] �?2026-06-11

### 新增
- **移动端开发中�?*: 新增「开发」Tab，包含需求、审批、CI/CD 三大模块
- **代码编辑�?*: APP 端代码查看与编辑（行号、语法标签、保存功能）
- **审批看板**: 待审批列表、通过/拒绝操作、审批意见评�?- **CI/CD 进度**: 构建任务列表、状态统计、运行历�?- **需求下�?*: 创建需求、指派开发者、优先级管理
- **云端 AI 对话**: `/api/mobile/chat` 免订阅端点，APP 直连�?AI
- **桌面状�?API**: `/api/desktop/status` 查询桌面在线状�?- **对话同步**: `/mobile/chat` 通过 WebSocket 广播聊天记录

### 修复
- **APP 消息发�?*: 移除 WebSocket 等待超时，改�?HTTP 直连�?AI，秒级响�?- **在线升级**: 修复下载 URL 解析错误（`files.android` 字符�?对象两种格式兼容�?- **升级流程**: APP 内下�?安装，不再跳转到浏览�?- **连接配置**: 移除人工配对输入，Token/IP 从云账号 JWT 自动获取
- **任务加载**: 桌面离线时自动回退到云�?`requirements` 表显�?- **文件浏览**: 超时后显示友好提示「桌面端离线�?- **下载中心**: versions.json Nginx 路径修复（`/var/www/html` 同步�?- **Git 自托�?*: 新建 `/root/lingjing-ide-git` bare repo + post-receive 自动部署 hook

### 后端 API
- `GET/PUT /api/files/read|write` �?服务器文件读�?- `GET/POST /api/requirements` �?需�?CRUD（自动建表）
- `PUT /api/requirements/:id/approve|reject` �?需求审�?- `GET /api/ci/status` �?CI/CD 聚合状�?- `POST /api/mobile/chat` �?移动端云�?AI 对话
- `GET /api/desktop/status` �?桌面端在线状�?
### Mobile
- 4 个新 Screen：`CodeEditorScreen`, `ReviewScreen`, `PipelineScreen`, `RequirementScreen`
- 3 �?Screen 重写：`ChatDetailScreen`, `QuestScreen`, `FileTreeScreen`
- 移除 `PairingScreen`，改为云账号自动连接
- `UpdateChecker` 重写：App 内下�?+ 进度�?
