#!/bin/bash
cd /home/liuhui/lingjing/mobile/android
export ANDROID_HOME=/opt/android-sdk
rm -rf /tmp/metro-* /tmp/haste-* app/build/generated 2>/dev/null || true
./gradlew assembleRelease -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease --no-daemon
echo "BUILD_DONE"
ls -la app/build/outputs/apk/release/app-release.apk
