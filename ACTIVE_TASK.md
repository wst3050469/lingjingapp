# v1.72.26 全平台部署 ✅

**时间**: 2026-06-12
**状态**: ✅ 全部完成 (8/8)

## 完成事项
1. v1.72.26 Windows (Setup + Portable) — 本地 Electron Builder
2. v1.72.26 Linux (AppImage + DEB) — 构建机 (192.168.1.9)
3. v1.72.26 macOS (x64 + arm64) — 构建机交叉编译
4. v1.72.26 Android APK — 本地 Windows Java 17 gradlew
5. v1.72.26 源码包 — git archive 生产服务器
6. versions.json + latest-*.yml (3个) 全部更新
7. PM2 6/6 ONLINE
8. Git `06fae8ae3` pushed

## 变更概要
- v1.72.26 = dist/ 编译产物恢复 (零源代码变更)
- 版本号统一: package.json(root/core/renderer/electron) → 1.72.26
- electron-builder.json output → release-v17226
- Android: versionCode 63, versionName 1.72.26
- Linux DEB: gzip 替代 xz (fpm 卡死)

## 平台状态 (8/8)
| # | 平台 | 产物 | 大小 |
|---|------|------|------|
| 1 | Windows Setup | LingJing-Setup-1.72.26-win-x64.exe | 146MB |
| 2 | Windows Portable | LingJing-Portable-1.72.26-win-x64.exe | 146MB |
| 3 | Linux AppImage | LingJing-1.72.26-linux-x86_64.AppImage | 173MB |
| 4 | Linux DEB | LingJing-1.72.26-linux-x86_64.deb | 169MB |
| 5 | macOS x64 | LingJing-1.72.26-mac-x64.zip | 166MB |
| 6 | macOS arm64 | LingJing-1.72.26-mac-arm64.zip | 161MB |
| 7 | Android | LingJing-1.72.26-android.apk | 36.6MB |
| 8 | 源码包 | lingjing-source-1.72.26.tar.gz | 479MB |
