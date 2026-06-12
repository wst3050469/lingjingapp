# Spec: 版本文件同步统一化

## Overview
将生产环境所有 `versions.json` 文件的读写统一到一个权威路径，确保 Admin 发布版本后所有客户端端点一致。

## 当前问题
生产环境存在 5+ 个 versions.json 副本：
| 路径 | 用途 |
|------|------|
| `/var/www/lingjing/versions.json` | cloud-server API 读取 |
| `/var/www/html/versions.json` | Nginx 下载页 |
| `/var/www/html/downloads/versions.json` | 下载页备用 |
| `/opt/lingjing/update-server/data/versions.json` | update-server:3000 |
| `/root/lingjing-update/data/versions.json` | update-server 备用 |

`admin-api.js` 的 `syncApprovedVersionsToJson()` 只写入 1-2 个，其他路径不同步。
`server.js` 的 `readVersionInfo()` 搜索 8 个路径，优先级不统一。

## 修改方案（最小改动原则）

### 修改 1：`admin-api.js` — `writeVersionsJson()` 全路径同步
- **不改** `findVersionsJsonPath()` 的搜索逻辑
- 在 `writeVersionsJson()` 中增加写入目标路径列表，确保所有已知路径都被同步
- 路径列表从 `findVersionsJsonPath()` 的搜索列表复用，但改为写入所有存在的路径（而非仅第一个）

### 修改 2：`server.js` — `readVersionInfo()` 统一主路径
- 将 `/var/www/html/versions.json` 提升为第一优先搜索路径（因为它是 Nginx 直接暴露的，也是 Admin `writeVersionsJson` 写入的路径之一）
- 缓存逻辑不变

## 影响文件
| 文件 | 改动类型 |
|------|----------|
| `services/backend/admin-api.js` | `writeVersionsJson()` 扩展写入目标 |
| `services/backend/server.js` | `readVersionInfo()` 搜索路径优先级调整 |

## 调用链分析
```
Admin approve/publish
  → syncApprovedVersionsToJson()
    → writeVersionsJson()
      → [修复后] 写入全部 5 个路径 ✅

客户端版本检测
  → GET /api/latest
    → server.js readVersionInfo()
      → [修复后] 优先读 /var/www/html/versions.json ✅
```

## 风险评估
- **风险等级**：低
- **回滚难度**：低（仅调整路径顺序 + 增加写入目标）
- **潜在问题**：5 个路径中某些可能因权限问题写入失败，需要静默处理
- **测试点**：
  1. Admin 发布版本后，验证所有 versions.json 路径内容一致
  2. `/api/latest` 返回正确版本号
  3. 无权限路径写入失败不应阻塞发布流程

## 不涉及
- 不修改 `promoteYamlFiles()`（已经在 approve/publish 中被调用）✅
- 不修改数据库 schema
- 不修改客户端代码
