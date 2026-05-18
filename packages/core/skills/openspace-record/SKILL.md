---
name: openspace-record
description: 控制OpenSpace录制，启动/停止录制、回放控制
triggers:
  - 开始录制
  - 停止录制
  - 暂停录制
  - start recording
  - stop recording
  - pause recording
  - 截图
  - screenshot
  - 录制视频
  - 回放
tools:
  - openspace_execute
parameters:
  action:
    type: string
    enum: [start, stop, pause, resume, screenshot]
    description: 录制操作类型
    required: true
  fps:
    type: number
    description: 录制帧率
    default: 30
    required: false
  resolution_x:
    type: number
    description: 录制分辨率宽度
    default: 1920
    required: false
  resolution_y:
    type: number
    description: 录制分辨率高度
    default: 1080
    required: false
  output_dir:
    type: string
    description: 输出目录路径
    required: false
  format:
    type: string
    enum: [png, jpg]
    description: 输出帧格式
    default: png
    required: false
examples:
  - input: 开始录制，30fps
    script: openspace.setPropertyValue("FrameExport.Enabled", true)\nopenspace.setPropertyValue("FrameExport.Framerate", 30)
  - input: 停止录制
    script: openspace.setPropertyValue("FrameExport.Enabled", false)
  - input: 截图
    script: openspace.setPropertyValue("FrameExport.TakeScreenshot", true)
  - input: 开始录制，60fps，1920x1080
    script: openspace.setPropertyValue("FrameExport.Enabled", true)\nopenspace.setPropertyValue("FrameExport.Framerate", 60)\nopenspace.setPropertyValue("FrameExport.Resolution.X", 1920)\nopenspace.setPropertyValue("FrameExport.Resolution.Y", 1080)
level: auto-generated
---
