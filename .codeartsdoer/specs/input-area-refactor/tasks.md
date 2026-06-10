# 输入区改造：移除@提及 + 通用文件上传

## 1. 新增 useFileAttachments Hook
- [x] 创建 `packages/renderer/src/hooks/useFileAttachments.ts`，统一管理图片+文档附件
- [x] 定义 FileAttachment 接口（id, name, type, path, size, dataUrl, content, parseStatus, ext）
- [x] 实现 addFiles（从input事件添加）、addFileFromFile（从File对象添加，拖拽/粘贴入口）
- [x] 实现图片处理（FileReader.readAsDataURL）
- [x] 实现文档异步解析（调用 electronAPI.context.parseDocument，更新 parseStatus）
- [x] 实现 removeAttachment、clearAttachments、triggerFileInput
- [x] 实现 images/documents 计算属性和 totalSize

## 2. 移除 useFileMentions Hook 及全部引用
- [x] 删除 `packages/renderer/src/hooks/useFileMentions.ts` 文件
- [x] QuestConversation.tsx：移除 useFileMentions import 和调用，移除 mentionedFiles/addMention/removeMention
- [x] ChatPanel.tsx：移除 useFileMentions import 和调用，移除 mentionedFiles/addMention/removeMention/clearMentions
- [x] ChatSidebar.tsx：移除 useFileMentions import 和调用，移除 mentionedFiles/addMention/removeMention/clearMentions

## 3. 改造 InputToolbar 组件
- [x] 移除 onMention 属性和 @提及按钮渲染
- [x] 将 onImage 重命名为 onFile，图标改为回形针SVG，tooltip 改为"上传文件"

## 4. 改造 ContextChips 组件
- [x] 替换 images/files 属性为 attachments: FileAttachment[]
- [x] 替换 onRemoveImage/onRemoveFile 为 onRemoveAttachment
- [x] 实现图片附件chip渲染（缩略图+文件名+移除按钮）
- [x] 实现文档附件chip渲染（格式图标+文件名+解析状态+移除按钮）
- [x] 实现文档格式图标映射函数 getDocIcon

## 5. 改造 QuestConversation 组件
- [x] 替换 useImageAttachments 为 useFileAttachments
- [x] 更新 ContextChips 传递：images/files → attachments，onRemoveImage/onRemoveFile → onRemoveAttachment
- [x] 更新 InputToolbar 传递：移除 onMention，onImage → onFile
- [x] 扩展隐藏 file input 的 accept 属性
- [x] 改造 useDragDropFiles 调用：onImageAdd → onFileAdd
- [x] handleSend 中构建文档 payload 并随消息发送
- [x] 发送后调用 clearAttachments 替代逐个 removeImage
- [x] 更新 placeholder 文案
- [x] 更新 canSend 判定

## 6. 改造 ChatInput 组件
- [x] 移除 onMention/onImage/onImageAdd/images/onRemoveImage props
- [x] 新增 onFile/attachments/onRemoveAttachment/onFileAdd props
- [x] onSend 签名变更：images → attachments
- [x] InputToolbar 调用：移除 onMention，onImage → onFile
- [x] 扩展隐藏 file input 的 accept 属性
- [x] 图片缩略图区域替换为 ContextChips 统一渲染

## 7. 改造 ChatPanel 组件
- [x] 替换 useImageAttachments 为 useFileAttachments
- [x] ChatInput props 传递变更：移除 onMention/images/onRemoveImage，新增 attachments/onRemoveAttachment
- [x] handleSend 中构建文档 payload 并随消息发送
- [x] 发送后调用 clearAttachments 替代 clearImages/clearMentions
- [x] 更新 canSend 判定

## 8. 改造 ChatSidebar 组件
- [x] 替换 useImageAttachments 为 useFileAttachments
- [x] ContextChips 传递变更：images/files → attachments
- [x] InputToolbar 传递变更：移除 onMention，onImage → onFile
- [x] handleSend 中构建文档 payload 并随消息发送
- [x] 发送后调用 clearAttachments 替代 clearImages/clearMentions
- [x] 扩展隐藏 file input 的 accept 属性
- [x] 更新 canSend 判定

## 9. 改造 useDragDropFiles Hook
- [x] 将 onImageAdd 改为 onFileAdd，统一处理图片和文档文件
- [x] handleFile 和 onPaste 中统一走 onFileAdd 回调

## 10. 改造 fs-ipc 文件选择对话框
- [x] fs:select-file handler 增加 filters 参数支持
- [x] 返回值从 string | null 变为 string[] | null，支持多文件选择
- [x] 添加默认 filters（所有支持文件/图片/文档/所有文件）

## 11. 验证与清理
- [x] 全局搜索 useFileMentions 确认无残留引用
- [x] 全局搜索 useImageAttachments 确认无残留引用（除 deprecated 原文件）
- [x] 全局搜索 onMention 确认无残留引用
- [x] 验证 TypeScript 编译无报错
