---
name: openspace-recording
version: 1.0.0
level: builtin
triggers: [录制, 开始录制, 停止录制, 回放, 帧导出]
tools: [openspace_execute]
requires_openspace: true
---

# OpenSpace 会话录制

控制 OpenSpace 会话录制与回放：开始/停止录制、配置帧导出参数、回放控制。

## 操作指令

### 开始录制
```
openspace.setPropertyValue("FrameExport.Enabled", true)
openspace.setPropertyValue("FrameExport.Resolution", "1920x1080")
openspace.setPropertyValue("FrameExport.Framerate", 30)
```

### 停止录制
```
openspace.setPropertyValue("FrameExport.Enabled", false)
```

### 暂停录制
```
openspace.setPropertyValue("FrameExport.Pause", true)
```

### 恢复录制
```
openspace.setPropertyValue("FrameExport.Pause", false)
```

### 回放
通过记录的操作时间线重发脚本命令序列，按时间间隔回放。

## 可用性
由 `OpenSpaceProcessManager.runState === 'running'` 决定。
