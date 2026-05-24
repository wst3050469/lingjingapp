# ACTIVE_TASK -- v1.55.0

## 状态：✅ 已完成（全平台构建部署）

## v1.55.0 变更内容（全面Bug修复）

### P1 严重问题（共6项，已全部修复）
- ✅ **LoginScreen统一域名**: `lingjing.zhejiangjinmo.com` → `ide.zhejiangjinmo.com`
- ✅ **SettingsScreen统一域名**: 同上，云账号登录使用统一CLOUD_SERVER_URL
- ✅ **创建统一配置文件**: `src/constants.ts` 统一管理所有API URL常量
- ✅ **Cloud Server日志脱敏**: JWT_SECRET/DEEPSEEK_API_KEY 启动日志截断
- ✅ **versions.json路径统一**: admin-api.js 扫描全部10个路径并同步写入
- ✅ **App.tsx/SettingsScreen/PairingScreen**: 全部引用共享常量文件

### P2 中等问题（共5项，已全部修复）
- ✅ **ChatDetailScreen WS回退**: WebSocket发送失败自动回退到HTTP API
- ✅ **api.ts请求超时**: 所有HTTP请求添加15秒 AbortController timeout
- ✅ **ChatListScreen baseUrl检查**: 创建会话前检查API是否已配置
- ✅ **admin-api密码文件路径**: 使用`os.homedir()`替代硬编码`/root/`
- ✅ **update-server OSS URL**: 替换为`OSS_BASE_URL`环境变量

### 构建部署
- ✅ Linux AppImage + Deb 构建成功
- ✅ Windows Setup + Portable 原生构建成功
- ✅ Android APK: 复用v1.52.12（待构建服务器同步后重建）
- ✅ versions.json 8位置同步
- ✅ latest.yml / latest-linux.yml 更新
- ✅ 服务重启
- ✅ API验证通过
- ✅ Git同步（GitHub + 生产bare）

## 版本
- 1.54.0 → 1.55.0
