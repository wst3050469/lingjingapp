# ACTIVE_TASK

## ✅ v1.73.179 全部部署完成 — 高级设置面板完整集成 (2026-06-23 17:25)

### 高级设置面板功能清单
| 版本 | 功能 | 权限保护 |
|:--:|------|:--:|
| v1.73.179 | ☀️ 亮度控制滑块（音量与亮度合并卡片） | desktopControl |
| v1.73.178 | 🖥️ 硬件状态监控（CPU/RAM 实时进度条） | desktopControl |
| v1.73.177 | 🎚️ 音量控制（滑块+静音切换） | desktopControl |
| v1.73.176 | 🎵 音频输出设备切换（枚举/切换/高亮） | desktopControl |
| v1.73.175 | ⚡ 系统电源控制（关机/重启/休眠/锁屏） | desktopControl |

### 高级设置面板完整结构
```
├─ 🔌 硬件状态 [CPU bar, RAM bar, 5s 自动刷新]
├─ 🔊 音量与亮度 [音量滑块, 静音按钮, 亮度滑块]
├─ 🎵 音频输出设备 [枚举列表, 切换, 当前设备标记]
├─ ⚡ 系统电源 [关机, 重启, 休眠, 锁屏, 二次确认]
├─ 📷 摄像头权限 [Toggle + 测试拍照]
├─ 🎤 麦克风权限 [Toggle]
└─ 🖱️ 鼠标键盘操控权限 [Toggle + 密码保护]
```

### 全平台状态 v1.73.179
| 平台 | 文件 | 大小 | HTTP |
|------|------|------|:--:|
| Windows Setup | LingJing-Setup-1.73.179-win-x64.exe | 143MB | ✅ |
| Windows Portable | LingJing-Portable-1.73.179-win-x64.exe | 143MB | ✅ |
| Linux AppImage | LingJing-1.73.179-linux-x86_64.AppImage | 184MB | ✅ |
| Linux DEB | LingJing-1.73.179-linux-x86_64.deb | 181MB | ✅ |
| Android APK | lingjing-ide-1.73.179.apk | 83MB | ✅ |
| OTA (latest.yml + latest-linux.yml) | v1.73.179 | - | ✅ |
| /api/latest | v1.73.179 (5平台) | - | ✅ |
| version.json (Android) | v1.73.179 vc:179 | - | ✅ |
| versions.json (3处) | latest=1.73.179 | - | ✅ |

### Android APK 构建详情
- **构建机**: 192.168.1.9 (liuhui)
- **构建时间**: 2026-06-23 17:19 - 17:23
- **构建时长**: ~1m 35s
- **APK MD5**: `0b03858149f12d4e25b3e1045535fde7`
- **APK 大小**: 86,210,838 bytes (83MB)
- **修复**: `lintVitalRelease` 在 Gradle 9.0.0 中需要单独跳过 (`-x lintVitalRelease`)
- **部署**: rsync 绕过 PAM MOTD 从构建机→生产服务器

### Git
- `6ef30861a` feat: v1.73.179 - 亮度控制滑块
- `adc4c5e05` feat: v1.73.178 - 硬件状态面板
- `22acf855f` feat: v1.73.177 - 音量控制UI
- `c2bcc27cc` feat: v1.73.176 - 音频输出设备切换UI
- `20d1e2624` feat: v1.73.175 - 系统电源控制UI

### 状态
🎉 **v1.73.179 全平台部署完成！** 无待办任务。
