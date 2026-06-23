# ACTIVE_TASK

## ✅ v1.73.167 — 录音60秒超时自动停止 (2026-06-23 10:00)

### 变更摘要
| 类别 | 内容 |
|:-----|:-----|
| 🎤 修复 | startRecording 添加 60s setTimeout 超时自动停止 |
| 🎤 修复 | stopRecording 清理超时定时器防泄漏 |
| 🧪 测试 | test-peripheral.html 补充录音测试UI |
| 🌐 部署 | 5平台全量部署 (Win+Linux+Android) |

### 构建产物
| 平台 | 文件 | 大小 | HTTP |
|:-----|:-----|:----:|:----:|
| Windows | LingJing-Setup-1.73.167-win-x64.exe | 143MB | ✅ 200 |
| Windows | LingJing-Portable-1.73.167-win-x64.exe | 143MB | ✅ 200 |
| Linux | LingJing-1.73.167-linux-x86_64.AppImage | 184MB | ✅ 200 |
| Linux | LingJing-1.73.167-linux-x86_64.deb | 181MB | ✅ 200 |
| Android | LingJing-Mobile-1.73.167.apk | 86MB | ✅ 200 |

### 服务状态
| 组件 | 版本 | 状态 |
|:-----|:----:|:----:|
| /api/latest | v1.73.167 | ✅ 5平台 |
| latest.yml | v1.73.167 | ✅ Windows |
| latest-linux.yml | v1.73.167 | ✅ Linux |
| version.json | v1.73.167 (vc:167) | ✅ Android |
| versions.json (3处) | latest=1.73.167 | ✅ |
| PM2 cloud-server | online | ✅ |

### 验证
- ✅ verify-audio-api.cjs 9/9 PASSED
- ✅ 60s超时逻辑: setTimeout + clearTimeout + recorder.stop()

### Git
- `4453f04c9` feat: v1.73.167 - add 60s timeout auto-stop to mic recording

### 等待新任务...

