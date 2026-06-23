# ACTIVE_TASK

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

### 全平台状态 v1.73.180
| 平台 | 版本 | HTTP |
|------|------|:--:|
| Android | v1.73.180 (vc:180) | ✅ |
| Windows/Linux | v1.73.179 | ✅ (此次仅移动端改动) |

### 状态
🎉 无待办任务。
