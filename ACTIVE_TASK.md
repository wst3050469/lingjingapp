# ACTIVE_TASK

## ✅ v1.73.165 — 音频设备枚举和控制 API (2026-06-23 06:30)

### 变更摘要
| 类别 | 内容 |
|:-----|:-----|
| 🔊 音频 | 新建 audio-control-ipc.ts (4个 IPC handler) |
| 🔊 枚举 | 跨平台音频设备枚举 (Win/Mac/Linux) |
| 🔊 切换 | 输出设备切换 (Windows) + 麦克风检测 |
| 🌐 部署 | 5平台全量部署 (Win+Linux+Android) |

### 新增 API
| 通道 | 功能 |
|:-----|:-----|
| `audio:enumerate-devices` | 枚举所有音频输入/输出设备 |
| `audio:get-active-device` | 获取当前活跃设备 |
| `audio:set-output-device` | 设置默认输出设备 (Win) |
| `audio:check-mic-available` | 检测麦克风可用性 |

## ✅ v1.73.164 — 全平台部署完成 (2026-06-22 19:00)

### 变更摘要
| 类别 | 内容 |
|:-----|:-----|
| 🎤 语音 | WebSocket 超时处理 (10s) + 资源清理 + lastError 暴露 |
| 📁 文件上传 | 移除 image/ 类型限制 + mediaType 字段 + FileIcon 组件 |
| 📷 摄像头 | capturePhoto() API + 测试按钮 + 预览功能 |
| 🔒 权限 | 摄像头/麦克风 Toggle (默认关闭) + 语音输入拦截 |

### 权限状态
| 权限 | 默认 | 保护 |
|:-----|:----:|:-----|
| 摄像头 | 🔒 OFF | 设置→高级→Toggle + capturePhoto |
| 麦克风 | 🔒 OFF | 设置→高级→Toggle + useVoiceInput 拦截 |
| 键盘/鼠标 | 🔒 OFF | 设置→高级→密码验证(scrypt) |

### 构建产物
| 平台 | 文件 | 大小 | HTTP |
|:-----|:-----|:----:|:----:|
| Windows | LingJing-Setup-1.73.164-win-x64.exe | 143MB | ✅ 200 |
| Windows | LingJing-Portable-1.73.164-win-x64.exe | 143MB | ✅ 200 |
| Linux | LingJing-1.73.164-linux-x86_64.AppImage | 183MB | ✅ 200 |
| Linux | LingJing-1.73.164-linux-x86_64.deb | 181MB | ✅ 200 |
| Android | LingJing-Mobile-1.73.164.apk | 82MB | ✅ 200 |

### 服务状态
| 组件 | 版本 | 状态 |
|:-----|:----:|:----:|
| /api/latest | v1.73.164 | ✅ 5平台 |
| latest.yml | v1.73.164 | ✅ Windows |
| latest-linux.yml | v1.73.164 | ✅ Linux |
| version.json | v1.73.164 (vc:84) | ✅ Android |
| versions.json (3处) | latest=1.73.164 | ✅ |
| HTTP (5 files) | v1.73.164 | ✅ 全部200 |
| PM2 cloud-server | online | ✅ PID 2870558 |

### Git
- `7954536e7` feat: v1.73.164 - voice input timeout handling + file upload type expansion + UI adaptations
- `8bc41aafb` chore: v1.73.164部署日志+清理临时文件

### 等待新任务...
