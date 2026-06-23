# ACTIVE_TASK

## ✅ v1.73.173 - 音频输出切换跨平台支持 (2026-06-23 14:50)

### 变更摘要
| 类别 | 内容 |
|:-----|:-----|
| 🔧 修复 | 音频输出切换从 Windows Only → 支持 macOS + Linux |

### 修改文件
| 文件 | 改动 |
|:-----|:-----|
| `packages/electron/src/ipc/audio-control-ipc.ts` | +60/-14行 (set-output-device 跨平台 + Linux rawName) |

### 构建部署
| 平台 | 状态 |
|:-----|:----:|
| Windows (Setup+Portable) | ✅ |
| Linux (AppImage+deb) | ✅ |
| OTA (latest.yml×2 + versions.json×3) | ✅ |

### 已知缺陷剩余
| # | 缺陷 | 优先级 |
|---|------|:--:|
| ④ | 截屏格式 | 低 |
| ⑥ | 物理操作缺失（电源/蓝牙等）| 低 |

### 等待新任务...
