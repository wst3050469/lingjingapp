#!/bin/bash
#!/bin/bash
# 灵境 全平台构建脚本（适用 192.168.1.9）
# 用法: ./build-all.sh [android|linux|win|all]
#   android - 仅构建 Android APK
#   linux   - 仅构建 Linux (AppImage + Deb)
#   win     - 仅构建 Windows (Setup + Portable，需 Wine)
#   all     - 构建所有平台

set -e
MODE=${1:-all}

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export NODE_OPTIONS="--no-warnings"
export ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

echo "=== 灵境 v$(cat /home/liuhui/lingjingapp/package.json | grep version | head -1 | cut -d'"' -f4) 构建 ==="
echo "平台: $(nproc)核 / $(free -h | grep Mem | awk '{print $2}') 内存"

cd /home/liuhui/lingjingapp/packages/electron

if [ "$MODE" = "all" ] || [ "$MODE" = "android" ]; then
  echo ""
  echo ">>> [Android] 构建 APK..."
  cd /home/liuhui/lingjingapp/android
  ./gradlew assembleRelease 2>&1 | tail -5
  echo "APK: $(ls -lh app/build/outputs/apk/release/app-release.apk 2>/dev/null | awk '{print $5, $NF}')"
  cd /home/liuhui/lingjingapp/packages/electron
fi

if [ "$MODE" = "all" ] || [ "$MODE" = "linux" ]; then
  echo ""
  echo ">>> [Linux] 构建 AppImage + Deb..."
  node scripts/pre-package.mjs 2>&1 | tail -3
  npx electron-builder build --linux --x64 --config electron-builder.json 2>&1 | tail -5
  echo "Linux: $(ls -lh release/LingJing-*.AppImage 2>/dev/null | awk '{print $5, $NF}')"
fi

if [ "$MODE" = "all" ] || [ "$MODE" = "win" ]; then
  echo ""
  echo ">>> [Windows] 交叉编译 Setup + Portable..."
  node scripts/pre-package.mjs 2>&1 | tail -3
  npx electron-builder build --win --x64 --config electron-builder.json 2>&1 | tail -5
  echo "Windows: $(ls -lh release/LingJing-Setup-*-win-x64.exe 2>/dev/null | awk '{print $5, $NF}')"
fi

echo ""
echo "=== 构建完成 ==="
