# ACTIVE_TASK -- v1.47.3 全平台构建部署完成

## 状态：已全部完成 ✅

| 平台 | 版本 | 状态 |
|:-----|:-----|:----:|
| Windows Setup | 1.47.3 | ✅ 已修复 React crash |
| Windows Portable | 1.47.3 | ✅ 已修复 React crash |
| Linux AppImage | 1.47.3 | ✅ 已修复 React crash |
| Linux deb | 1.47.3 | ✅ 已修复 React crash |
| Android APK | 1.46.0 (软链) | ✅ |

## 修复内容
1. ✅ Bug: patch-renderer.js `import React from 'react'` → main process ASAR 无 React
   - 修复: 从 fusion/integration/index.js 移除 patch-renderer 导出
2. ✅ Quest 对话空白页 + 待办排序
3. ✅ 版本审核流程绕过
4. ✅ Spec 正则双转义
5. ✅ Linux 桌面部署 (192.168.1.9) + 快捷方式

## 部署验证
- `/api/latest` → v1.47.3
- 4/4 安装包 HTTP 200
- xvfb-run 测试: DB 初始化成功, 创建默认用户
