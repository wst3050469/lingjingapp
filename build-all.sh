#!/bin/bash
# 灵境 v1.51.0+ 一键构建脚本（适用 192.168.1.9）
# 用法: ./build-all.sh [android|linux|all]

set -e
MODE=${1:-all}

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export NODE_OPTIONS="--no-warnings"
export ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

echo "=== 灵境 v$(cat /home/liuhui/lingjing/package.json | grep version | head -1 | cut -d'"' -f4) 构建 ==="
echo "平台: $(nproc)核 / $(free -h | grep Mem | awk '{print $2}') 内存"

if [ "$MODE" = "all" ] || [ "$MODE" = "android" ]; then
  echo ""
  echo ">>> [1/2] 构建 Android APK..."
  cd /home/liuhui/lingjing/android
  ./gradlew assembleRelease 2>&1 | tail -5
  echo "APK: $(ls -lh app/build/outputs/apk/release/app-release.apk 2>/dev/null | awk '{print $5, $NF}')"
fi

if [ "$MODE" = "all" ] || [ "$MODE" = "linux" ]; then
  echo ""
  echo ">>> [2/2] 构建 Linux 桌面版..."
  cd /home/liuhui/lingjing/packages/electron
  node scripts/pre-package.mjs 2>&1 | tail -3
  npx electron-builder build --linux --x64 --config electron-builder.json 2>&1 | tail -5
  echo "Linux: $(ls -lh release-v1510/LingJing-*.AppImage 2>/dev/null | awk '{print $5, $NF}')"
fi

echo ""
echo "=== 构建完成 ==="
