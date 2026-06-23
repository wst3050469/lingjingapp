# ACTIVE_TASK

## ✅ v1.73.180 — APP页面崩溃修复 (NavigationContainer theme) (2026-06-23 18:10)

### 问题
用户报告 APP 登录后"页面出错了" -> `Cannot read property 'regular' of undefined`

### 根因
`App.tsx` 中 `NavigationContainer` 的 `theme` prop 使用手动构造，缺少 `fonts` 字段。
React Navigation v7 内部 `@react-navigation/elements` 通过 `useTheme()` 获取主题后访问 `fonts.regular`，手动构造导致 `fonts` 为 `undefined` → 崩溃。

**此 bug 第3次复现！** 之前修复:
- v1.73.156 (2026-06-22) — 首次修复
- v1.73.170 (2026-06-23) — 第二次修复（被覆盖）
- v1.73.180 (2026-06-23) — **第三次修复**（又被覆盖）

### 修复
```tsx
// Before: 手动构造（缺 fonts）
<NavigationContainer theme={{ dark: isDarkMode, colors: {...} }}>

// After: 基于标准主题展开（含 fonts）
<NavigationContainer theme={isDarkMode
  ? { ...DarkTheme, colors: { ...DarkTheme.colors, ...customDarkColors } }
  : { ...DefaultTheme, colors: { ...DefaultTheme.colors, ...customLightColors } }
}>
```

### 代码改动
| 文件 | 改动 |
|------|------|
| `mobile/App.tsx` | +1 import (DefaultTheme/DarkTheme)，-14/+2 行 theme 重构 |

### 构建验证
| 检查项 | 状态 |
|--------|:--:|
| Metro JS bundle 重新打包 (43199ms, 1363 modules) | ✅ (确认修复打入) |
| APK 大小 83MB | ✅ |
| MD5: `ce3831f86c23b782b72ea0a0a2dfe866` | ✅ |

### 版本号
| 文件 | 旧版本 | 新版本 |
|------|--------|--------|
| `mobile/app.json` | 1.73.179 (vc:179) | 1.73.180 (vc:180) |
| `mobile/package.json` | 1.73.179 | 1.73.180 |

### 部署
| 项目 | 状态 |
|------|:--:|
| APK 上传 | ✅ 86,211,010 bytes |
| version.json | ✅ v1.73.180 vc:180 |
| versions.json (3处) | ✅ latest=1.73.180 |
| /api/latest android | ✅ |
| PM2 cloud-server | ✅ |

### ⚠️ 关键教训
1. 此修复已第三次被覆盖，说明存在代码合并/同步问题导致修复丢失
2. v1.73.179 APK 构建时 Metro bundle 为 UP-TO-DATE（用了旧缓存），**首次安装就会崩溃**
3. **必须确保修复代码在构建前已真正同步到构建机**
4. Metro 缓存检测基于文件 hash，App.tsx 修改后会自动重新打包

🎉 **v1.73.180 全平台部署完成！** 无待办任务。

