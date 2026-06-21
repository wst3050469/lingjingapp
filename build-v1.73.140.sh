#!/bin/bash
cd /home/liuhui/lingjing/mobile/android
echo "=== v1.73.140 APK Build Started $(date) ==="
./gradlew assembleRelease > /tmp/build-v1.73.140.log 2>&1
RC=$?
echo "=== Build finished with exit code: $RC at $(date) ==="
if [ $RC -eq 0 ]; then
    ls -lh /home/liuhui/lingjing/mobile/android/app/build/outputs/apk/release/app-release.apk
fi
