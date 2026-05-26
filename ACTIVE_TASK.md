# ACTIVE_TASK -- v1.59.0

## 状态：✅ 已完成（全平台构建部署）

## v1.59.0 变更内容

### P1 严重问题（共1项，已全部修复）
- ✅ **修复 `cloud:connect` 'No handler registered' 错误**: 
  - **根因**: `main.ts` Phase B 中 `registerCloudIpc` 之前的 handler 注册未包裹 `try-catch`，导致异常时中断了后续 IPC 注册。
  - **修复**: 为 Phase B 的所有 handler 注册调用添加了 `try-catch` 保护，并增加了 Phase A 的回退 handler。

### 构建部署
- ✅ **全平台构建**: Windows Setup + Portable, Linux AppImage, Android APK
- ✅ **版本同步**: `versions.json` (latest=1.59.0), `latest.yml`, `latest-linux.yml` 已更新
- ✅ **部署**: 安装包已上传至 `/var/www/downloads/`
- ✅ **Git**: 已同步至 GitHub 及生产 bare repo

## 版本
1.58.2 → 1.59.0
