# ACTIVE_TASK -- v1.52.9 全平台部署完成

## 状态：✅ 全部完成

## 当前交付

| 项目 | 版本 | 大小 | 状态 |
|:-----|:----:|:----:|:----:|
| 🪟 Windows Setup | v1.52.9 | 142 MB | ✅ 已部署 |
| 🪟 Windows Portable | v1.52.9 | 142 MB | ✅ 已部署 |
| 🐧 Linux AppImage | v1.52.9 | 173 MB | ✅ 已部署 |
| 🐧 Linux deb | v1.52.9 | 105 MB | ✅ 已部署 |
| 📱 Android APK | v1.52.9 | 78 MB | ✅ 已部署 |

## 本轮变更
### 输入区改造 — 移除@提及 + 通用文件上传（11项任务全部完成）
- 新增 `useFileAttachments.ts` — 统一附件管理Hook
- 删除 `useFileMentions.ts` + `useImageAttachments.ts`
- 改造 `InputToolbar.tsx` / `ContextChips.tsx` / `ChatInput.tsx` / `ChatPanel.tsx` / `ChatSidebar.tsx` / `QuestConversation.tsx`
- 改造 `useDragDropFiles.ts` / `fs-ipc.ts` / `electron.d.ts`
- 共13个文件变更：1新增、2删除、10修改
- TypeScript 编译零错误 ✅

## Git 同步
- GitHub: ✅ `2f263f3`
- 生产 bare repo (120.55.5.220): ✅ `2f263f3`
- 构建服务器 (192.168.1.9): ✅ `2f263f3`

## 生产服务器状态
- API `/api/latest` → v1.52.9 ✅
- 8个 versions.json 全部一致 md5=`e78cd5ea94fc72d86c03ed2108aa0e9e` ✅
- Nginx online ✅
- update-server (3001): online ✅
- lingjing-update-server (3002): online ✅
- cloud-server (8000): online ✅

## 版本号
- packages/electron/package.json: **1.52.9**
- package.json: **1.52.9**
