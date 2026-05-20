# 灵境 IDE — 任务跟踪

## 当前状态：✅ v1.45.0 全平台已部署

### 最新版本：v1.45.0
**发布说明**: 灵境IDE v1.45.0 - 新增版本审核流程UI（reviewStatus: draft→review→published）

### 已部署的平台包
| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | LingJing-Setup-1.45.0-win-x64.exe | 126 MB | ✅ 生产环境 |
| 🪟 Windows Portable | LingJing-Portable-1.45.0-win-x64.exe | 125 MB | ✅ 生产环境 |
| 🐧 Linux AppImage | LingJing-1.45.0-linux-x86_64.AppImage | 171 MB | ✅ 生产环境 |
| 🐧 Linux deb | LingJing-1.45.0-linux-x86_64.deb | 104 MB | ✅ 生产环境 |
| 🤖 Android APK | lingjing-mobile-v1.44.9.apk | 81 MB | ✅ 生产环境 |

### 部署验证
| 检查项 | 结果 |
|:-------|:----:|
| `/api/latest` → v1.45.0 (4 平台文件) | ✅ |
| `latest.yml` → v1.45.0 | ✅ |
| `latest-linux.yml` → v1.45.0 (AppImage+deb) | ✅ |
| `versions.json` → latest: 1.45.0 | ✅ |
| Linux AppImage HTTP 200 | ✅ |
| Linux deb HTTP 200 | ✅ |
| 旧 v1.44.8/v1.44.9 Linux 文件已清理 | ✅ |

### v1.45.0 修复内容
- 新增版本审核流程UI（reviewStatus: draft→review→published）
- Windows 已构建部署完成
- Linux 已在服务器构建并部署至下载目录

### Git 状态
- 本地: 未提交（含 v1.45.0 变更 + 临时脚本）
- 服务器: `69fd64c` (v1.45.0 源码)
- 需推送至 GitHub

### 服务健康
- PM2: 4/4 online 🟢
- API /api/latest: v1.45.0 (4 平台文件) ✅
- 磁盘: ~34% ✅
