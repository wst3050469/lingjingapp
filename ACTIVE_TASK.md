# ACTIVE_TASK

## ✅ v1.73.181 — APP对话 subscription_required 修复 (2026-06-23 19:30)

### 已完成
| # | 任务 | 版本 | Git |
|---|------|:--:|------|
| 1 | 修复 APP 对话 subscription_required | v1.73.181 | `8f4d9953f` |
| 2 | PM2 ecosystem.config.cjs (.env 自动加载) | v1.73.181 | `7dfe6085e` |
| 3 | 全子包版本同步 | v1.73.181 | `0925755cc` |

### 修复内容
- `cloud-server/server.js` L1852: `requireSubscription('personal',true)` → `(null,true)`
- 移除最低套餐门槛，保留每日 API 配额检查
- server-only fix，无需客户端重建

### 部署状态 v1.73.181
| 平台 | 版本 | 类型 |
|------|------|:--:|
| Cloud Server | v1.73.181 | ✅ 已部署 |
| Android | v1.73.181 (vc:181) | 📦 无需重建 |
| Windows/Linux | v1.73.181 | 📦 无需重建 |

### 状态
🎉 无待办任务。


## ✅ v1.73.180 — APP崩溃修复 + 防回归机制 (2026-06-23 18:20)

### 已完成
| # | 任务 | 版本 | Git |
|---|------|:--:|------|
| 1 | 修复 APP 页面崩溃 (NavigationContainer theme) | v1.73.180 | `1de3dbcbe` |
| 2 | 新增 `validate-app-theme.js` 防回归检查 | v1.73.180 | `8c746a7f0` |
| 3 | 新增 `build-apk.sh` 标准化构建流程 | v1.73.180 | `8c746a7f0` |

### 防回归机制
```
构建前自动检查:
  ✅ DefaultTheme/DarkTheme 导入
  ✅ 禁止手动构造 theme={{...}}
  ✅ 必须使用 ...DarkTheme / ...DefaultTheme 展开
```

### 标准化构建流程
```bash
# 构建机上一键构建（含验证）
ssh liuhui@192.168.1.9
sh /home/liuhui/lingjing/mobile/scripts/build-apk.sh
```
