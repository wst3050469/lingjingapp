# ACTIVE_TASK

## ✅ v1.73.182 — 同步修复 + App润色提示词 + 键盘遮挡修复 (2026-06-24 00:02)

### 已完成
| # | 任务 | 版本 | Git |
|---|------|:--:|------|
| 1 | App消息同步至桌面端 (upsertSession) | v1.73.182 | — |
| 2 | App端润色提示词功能 (polishPrompt API) | v1.73.182 | — |
| 3 | Android键盘遮挡修复 | v1.73.182 | — |
| 4 | cloud-server /api/prompt/polish 端点 | v1.73.182 | — |
| 5 | APK 构建部署 | v1.73.182 | — |

### 部署状态 v1.73.182
| 平台 | 版本 | 状态 |
|------|------|:--:|
| Cloud Server | v1.73.182 | ✅ 已部署 |
| Android APK | v1.73.182 (vc:182) | ✅ 已部署 |
| Windows/Linux | v1.73.181 | 📦 无需重建(server+app only) |

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
