# ACTIVE_TASK

## ✅ v1.73.172 - 摄像头录像功能 (2026-06-23 14:45)

### 变更摘要
| 类别 | 内容 |
|:-----|:-----|
| ✨ 新增 | 摄像头 startRecording/stopRecording（MediaRecorder, 最长60秒） |

### 修改文件
| 文件 | 改动 |
|:-----|:-----|
| `packages/electron/src/preload.ts` | +95行 startRecording/stopRecording |
| `packages/renderer/src/types/electron.d.ts` | +2行 类型声明 |

### 构建部署
| 平台 | 状态 |
|:-----|:----:|
| Windows (Setup+Portable) | ✅ |
| Linux (AppImage+deb) | ✅ |
| Android (APK) | ✅ |
| version.json | ✅ v1.73.172 vc:172 |
| latest.yml + latest-linux.yml | ✅ |
| versions.json (3处) | ✅ |
| PM2 cloud-server | ✅ |

### 已知缺陷剩余
| # | 缺陷 | 优先级 |
|---|------|:------:|
| ③ | 音频输出切换仅Windows | 低 |
| ④ | 截屏格式 | 低 |
| ⑥ | 物理操作缺失（电源/蓝牙等）| 低 |

### 等待新任务...
