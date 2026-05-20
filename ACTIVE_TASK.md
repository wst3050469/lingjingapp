# 灵境 IDE — 任务跟踪

## 当前状态：✅ v1.45.0 全平台已部署

### 最新版本：v1.45.0
**发布说明**: 灵境IDE v1.45.0 - 移动端登录密码预哈希修复 + 管理后台 MIME 类型修复

### 已部署的平台包
| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | LingJing-Setup-1.45.0-win-x64.exe | 126 MB | ✅ 生产环境 |
| 🪟 Windows Portable | LingJing-Portable-1.45.0-win-x64.exe | 125 MB | ✅ 生产环境 |
| 🐧 Linux AppImage | LingJing-1.45.0-linux-x86_64.AppImage | 171 MB | ✅ 生产环境 |
| 🐧 Linux deb | LingJing-1.45.0-linux-x86_64.deb | 104 MB | ✅ 生产环境 |
| 🤖 Android APK | lingjing-mobile-v1.45.0.apk | 78 MB | ✅ 生产环境 |

### 部署验证
| 检查项 | 结果 |
|:-------|:----:|
| `/api/latest` → v1.45.0 (5 平台文件) | ✅ |
| `latest.yml` → v1.45.0 | ✅ |
| `latest-linux.yml` → v1.45.0 (AppImage+deb) | ✅ |
| `versions.json` → latest: 1.45.0 | ✅ |
| Windows Setup HTTP 200 (126 MB) | ✅ |
| Linux AppImage HTTP 200 (171 MB) | ✅ |
| Linux deb HTTP 200 (104 MB) | ✅ |
| Android APK HTTP 200 (78 MB) | ✅ |
| 旧版文件已清理 | ✅ |

### v1.45.0 修复内容
- **移动端登录修复**: SHA-256 密码预哈希对齐桌面端认证链（api.ts + LoginScreen.tsx）
- **管理后台 MIME 修复**: JS/CSS 静态资源 Content-Type 修复（server.js）
- **云服务器日志增强**: 全局错误处理器记录请求路径与方法

### Git 状态
- GitHub: `077378781` → `main` ✅ 已推送
- 生产裸仓库 `/root/lingjing_git`: `0773787` ✅ 已同步
- 本地工作区: ✅ 干净（无待办变更）

### 服务健康
- PM2: 4/4 online 🟢 (cloud-server, scms-server, scms-web, update-server)
- API `/api/latest`: v1.45.0 (5 平台文件) ✅
- 管理后台: ✅ JS/CSS MIME 类型已修复
- 磁盘: ~34% ✅

### 最近修复
| 修复项 | 状态 |
|:-------|:----:|
| 管理后台 JS/CSS MIME 类型错误 (text/html→application/javascript) | ✅ |
| 移动端 invalid_credentials 登录错误 (密码预哈希对齐桌面端) | ✅ 已构建 APK v1.45.0 并部署 |
| v1.45.0 Linux 安装包部署 | ✅ |
| v1.45.0 Android APK 构建部署 | ✅ |
| v1.45.0 GitHub 推送 + 生产裸仓库同步 | ✅ |
