# ACTIVE_TASK

## ✅ v1.73.166 — 麦克风录音功能 (2026-06-23 09:45)

### 变更摘要
| 类别 | 内容 |
|:-----|:-----|
| 🎤 录音 | preload.ts 实现 startRecording/stopRecording API |
| 🎤 权限 | 录制前检查麦克风权限状态 |
| 🌐 部署 | 5平台全量部署 (Win+Linux+Android) |

### 新增 API
| API | 位置 | 说明 |
|:-----|:-----|:-----|
| `audio.startRecording()` | preload.ts | getUserMedia + MediaRecorder，最长60秒 |
| `audio.stopRecording()` | preload.ts | 停止录制返回 base64 WAV |

### 构建产物
| 平台 | 文件 | 大小 | HTTP |
|:-----|:-----|:----:|:----:|
| Windows | LingJing-Setup-1.73.166-win-x64.exe | 143MB | ✅ 200 |
| Windows | LingJing-Portable-1.73.166-win-x64.exe | 143MB | ✅ 200 |
| Linux | LingJing-1.73.166-linux-x86_64.AppImage | 184MB | ✅ 200 |
| Linux | LingJing-1.73.166-linux-x86_64.deb | 181MB | ✅ 200 |
| Android | LingJing-Mobile-1.73.166.apk | 86MB | ✅ 200 |

### 服务状态
| 组件 | 版本 | 状态 |
|:-----|:----:|:----:|
| /api/latest | v1.73.166 | ✅ 5平台 |
| latest.yml | v1.73.166 | ✅ Windows |
| latest-linux.yml | v1.73.166 | ✅ Linux |
| version.json | v1.73.166 (vc:166) | ✅ Android |
| versions.json (3处) | latest=1.73.166 | ✅ |
| PM2 cloud-server | online | ✅ |

### Git
- `e92dae836` docs: v1.73.166 deployment - mic recording + full platform deploy

### 等待新任务...
