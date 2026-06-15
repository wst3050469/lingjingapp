#!/bin/bash
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
cd /home/liuhui/lingjing/mobile
echo "=== npm install ==="
npm install 2>&1 | tail -20
echo "NPM_EXIT:${PIPESTATUS[0]}"
echo ""
echo "=== gradle build ==="
cd android
chmod +x gradlew
./gradlew assembleDebug 2>&1 | tail -20
echo "GRADLE_EXIT:${PIPESTATUS[0]}"
echo ""
echo "=== APK files ==="
find . -path "*/build/outputs/apk/*.apk" -type f 2>/dev/null
echo "DONE"
