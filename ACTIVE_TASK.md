# ACTIVE_TASK — v1.44.1 全平台构建与部署完成

## 当前状态: ✅ 生产运行正常

### 部署状态 (v1.44.1)

| 平台 | 文件 | 大小 | 状态 |
|:-----|:-----|:----:|:----:|
| 🪟 Windows Setup | `LingJing-Setup-1.44.1-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🪟 Windows Portable | `LingJing-Portable-1.44.1-win-x64.exe` | 131 MB | ✅ 已部署 |
| 🐧 Linux AppImage | `LingJing-1.44.1-linux-x86_64.AppImage` | 172 MB | ✅ 已部署 |
| 🐧 Linux deb | `LingJing-1.44.1-linux-x86_64.deb` | 168 MB | ✅ 已部署 |
| 🤖 Android APK | `lingjing-mobile-v1.44.0.apk` | 81 MB | ✅ 未变 |

### 在线升级修复
| 项目 | 状态 |
|:-----|:----:|
| SHA512 格式修正 (88 base64) | ✅ |
| Nginx /downloads/ 无 301 | ✅ |
| HASH_MISMATCH 错误类型 | ✅ |
| feedURL 尾随斜杠 | ✅ |

### v1.44.1 修复内容
- **DEFAULT_CONFIG 导出缺失** — `src/index.ts` 拆分导出：`loadConfig` 从 `loader.js`、`DEFAULT_CONFIG` 从 `defaults.js`；`config/loader.js` 添加 re-export

### API 状态
- `/api/latest` → v1.44.1 (含 win/win-portable/linux/linux-deb/android) ✅
- `latest.yml` → v1.44.1 ✅
- `latest-linux.yml` → v1.44.1 ✅
- `versions.json` → latest: 1.44.1 ✅

### 服务器
- cloud-server:8000 ✅ | update-server:3000 ✅ | nginx 80/443 ✅
- 构建服务器 192.168.1.9 (liuhui): lingjing-ide v1.44.0 (待在线升级到 v1.44.1)

### Git
- 主仓: `625683dc0` — fix: v1.44.1 - bump version and fix DEFAULT_CONFIG export ✅
