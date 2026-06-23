# ACTIVE_TASK

## ✅ v1.73.171 - 键盘中文输入支持 (2026-06-23 14:30)

### 变更摘要
| 类别 | 内容 |
|:-----|:-----|
| 🐛 修复 | 桌面控制键盘不支持中文（robotjs typeString 仅 ASCII） |
| 🔧 方案 | ASCII→robotjs 原生；非 ASCII→clipboard Ctrl+V 粘贴 |

### 修改文件
| 文件 | 改动 |
|:-----|:-----|
| `packages/electron/src/ipc/desktop-control-ipc.ts` | +48行 (clipboard import + typeText/isAsciiOnly/sleep + 重构2个handler) |

### 构建部署
| 平台 | 状态 |
|:-----|:----:|
| Windows (Setup+Portable) | ✅ |
| Linux (AppImage+deb) | ✅ |
| Android (APK) | ✅ |
| version.json | ✅ v1.73.171 vc:171 |
| latest.yml + latest-linux.yml | ✅ |
| versions.json (3处) | ✅ |
| PM2 cloud-server | ✅ |

### 已知缺陷剩余
| # | 缺陷 | 优先级 |
|---|------|:------:|
| ③ | 音频输出切换仅Windows | 低 |
| ④ | 截屏仅BMP格式（已有PNG但API默认仍BMP） | 低 |
| ⑤ | 摄像头无录像 | 中 |
| ⑥ | 物理操作缺失（电源/蓝牙等）| 低 |

### 等待新任务...
