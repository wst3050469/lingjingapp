#!/bin/bash
cd /home/liuhui/灵境/app
flutter build apk --release --no-tree-shake-icons 2>&1 | tail -5
if [ $? -eq 0 ]; then
  cp build/app/outputs/flutter-apk/app-release.apk /home/liuhui/灵境/dist/lingjing-mobile-v1.60.1.apk
  echo "BUILD SUCCESS: APK copied to lingjing-mobile-v1.60.1.apk"
else
  echo "BUILD FAILED"
fi
