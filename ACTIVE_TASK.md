# ACTIVE_TASK -- v1.53.0

## 状态：✅ 全部完成（全平台构建部署）

## 当前交付

| 项目 | 版本 | 大小 | 状态 |
|:-----|:----:|:----:|:----:|
| 🐧 Linux AppImage | v1.53.0 | 172 MB | ✅ 已部署 |
| 🐧 Linux Deb | v1.53.0 | 104 MB | ✅ 已部署 |
| 🪟 Windows Setup | v1.53.0 | 136 MB | ✅ 新构建部署 |
| 🪟 Windows Portable | v1.53.0 | 135 MB | ✅ 新构建部署 |
| 📱 Android APK | v1.52.12 | 78 MB | ✅ 已部署（复用） |

## v1.53.0 变更内容
- **版本升级**: 1.52.12 → 1.53.0
- **Todo修复**: 交换布局顺序（待办在变更文件上方）+ 切换任务不再清空待办
- **Admin认证持久化**: 用户数据保存到 ~/.lingjing/admin-auth.json
- **MCP安装器重构**: EventEmitter + InstallProgress 类型 + HTTP/HTTPS源支持
- **Windows构建(本地)**: Setup 142MB / Portable 136MB + blockmap

## 数据同步
- 8个 versions.json 全部同步一致 md5=`0f859e2b` ✅
- latest.yml + latest-linux.yml 同步更新 ✅

## 服务器状态
| 服务 | 端口 | 状态 |
|:-----|:----:|:----:|
| cloud-server | 8000 | ✅ online |
| update-server | 3001 | ✅ online |
| lingjing-update-server | 3002 | ✅ online |

## API验证
- `/api/latest` → `{"version":"1.53.0"}` ✅
- Windows文件 HTTP 200 验证 ✅

## Git
- 📦 本地: `113dbe15e` ✅
- 📦 生产bare: 已推送 ✅
