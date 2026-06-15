# Spec: v1.73.77 完整发布

## Overview
将 v1.73.77 的 4 个待提交变更（版本号升级 + __safeRequireCodepilot v5 升级）完成 Git 提交，构建 Windows/Linux 安装包并部署到生产服务器，推送所有远程仓库。

## 变更内容
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `desktop/core/package.json` | 版本号 | 1.73.76 → 1.73.77 |
| `desktop/electron/package.json` | 版本号 | 1.73.76 → 1.73.77 |
| `desktop/electron/electron-builder.json` | 输出目录 | release-v17376 → release-v17377 |
| `desktop/electron/scripts/build-main.mjs` | 代码升级 | __safeRequireCodepilot v4→v5 |

## __safeRequireCodepilot v5 改进
- 将 auto-repair 逻辑提取为独立函数 `__repairCodepilot()`
- 触发条件从仅 NEEDS_REPAIR 扩展到所有 MODULE_NOT_FOUND 错误
- auto-repair 成功后自动重试 require，无需用户重启

## 影响文件
- 本地构建：`desktop/electron/scripts/build-main.mjs`（esbuild 构建入口）
- 构建产物：`release-v17377/` 目录
- 生产部署：`/var/www/downloads/1.73.77/` + latest.yml + versions.json

## 部署步骤
1. Git add + commit
2. pnpm build（前端 vite 构建）
3. node build-main.mjs（主进程 esbuild 构建）
4. electron-builder --win portable（Windows 便携版）
5. SCP 到构建机 + electron-builder --linux（Linux AppImage + deb）
6. SCP 上传到生产服务器
7. 更新 latest.yml / latest-linux.yml / versions.json
8. 同步到 update-server（3 路径）
9. PM2 重启
10. 推送 Git 远程仓库

## 验证点
- [ ] Windows Portable 下载 → 200 OK
- [ ] Linux AppImage 下载 → 200 OK
- [ ] Linux deb 下载 → 200 OK
- [ ] /api/latest 返回 v1.73.77 + status: published
- [ ] latest.yml sha512 匹配实际文件
