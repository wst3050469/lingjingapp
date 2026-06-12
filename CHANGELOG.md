# 灵境IDE 更新日志

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)。

## [1.73.34] — 2026-06-12

### 修复
- **版本检测误报**: 修复云端 versions.json 数据源不同步导致客户端版本检测异常
  - 6个 versions.json 文件统一为 latest: 1.73.34
  - cloud-server / update-server / lingjing-update-server 全部修复 hasUpdate 智能对比
  - `/api/latest` 新增 `?current=` 参数支持客户端版本对比
  - 新增排查文档 `docs/version-troubleshooting.md`

## [1.73.0] — 2026-06-11

### 新增
- **移动端开发中心**: 新增「开发」Tab，包含需求、审批、CI/CD 三大模块
- **代码编辑器**: APP 端代码查看与编辑（行号、语法标签、保存功能）
- **审批看板**: 待审批列表、通过/拒绝操作、审批意见评论
- **CI/CD 进度**: 构建任务列表、状态统计、运行历史
- **需求下发**: 创建需求、指派开发者、优先级管理
- **云端 AI 对话**: `/api/mobile/chat` 免订阅端点，APP 直连云 AI
- **桌面状态 API**: `/api/desktop/status` 查询桌面在线状态
- **对话同步**: `/mobile/chat` 通过 WebSocket 广播聊天记录

### 修复
- **APP 消息发送**: 移除 WebSocket 等待超时，改为 HTTP 直连云 AI，秒级响应
- **在线升级**: 修复下载 URL 解析错误（`files.android` 字符串/对象两种格式兼容）
- **升级流程**: APP 内下载+安装，不再跳转到浏览器
- **连接配置**: 移除人工配对输入，Token/IP 从云账号 JWT 自动获取
- **任务加载**: 桌面离线时自动回退到云端 `requirements` 表显示
- **文件浏览**: 超时后显示友好提示「桌面端离线」
- **下载中心**: versions.json Nginx 路径修复（`/var/www/html` 同步）
- **Git 自托管**: 新建 `/root/lingjing-ide-git` bare repo + post-receive 自动部署 hook

### 后端 API
- `GET/PUT /api/files/read|write` — 服务器文件读写
- `GET/POST /api/requirements` — 需求 CRUD（自动建表）
- `PUT /api/requirements/:id/approve|reject` — 需求审批
- `GET /api/ci/status` — CI/CD 聚合状态
- `POST /api/mobile/chat` — 移动端云端 AI 对话
- `GET /api/desktop/status` — 桌面端在线状态

### Mobile
- 4 个新 Screen：`CodeEditorScreen`, `ReviewScreen`, `PipelineScreen`, `RequirementScreen`
- 3 个 Screen 重写：`ChatDetailScreen`, `QuestScreen`, `FileTreeScreen`
- 移除 `PairingScreen`，改为云账号自动连接
- `UpdateChecker` 重写：App 内下载 + 进度条
