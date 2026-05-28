#!/bin/bash
set -e
cd /home/liuhui/灵境/app
echo "Starting Flutter APK build..."
flutter build apk --release --no-tree-shake-icons > /tmp/android_build.log 2>&1
BUILD_EXIT=$?
echo "Flutter build exit code: $BUILD_EXIT" >> /tmp/android_build.log
if [ $BUILD_EXIT -eq 0 ]; then
  cp build/app/outputs/flutter-apk/app-release.apk /home/liuhui/灵境/dist/lingjing-mobile-v1.60.1.apk
  echo "APK copied to lingjing-mobile-v1.60.1.apk" >> /tmp/android_build.log
  ls -lh /home/liuhui/灵境/dist/lingjing-mobile-v1.60.1.apk >> /tmp/android_build.log
else
  tail -20 /tmp/android_build.log
fi
echo "Build script completed"
