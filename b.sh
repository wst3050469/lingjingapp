#!/bin/bash
killall -9 java 2>/dev/null
sleep 5
rm -rf /home/liuhui/lingjing/android/.gradle /home/liuhui/lingjing/android/app/build
cd /home/liuhui/lingjing/android
cp /home/liuhui/lingjing-rel.keystore app/lingjing-rel.keystore 2>/dev/null
cp /home/liuhui/.android/debug.keystore app/debug.keystore 2>/dev/null
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export NODE_ENV=production
echo "START $(date)"
./gradlew assembleRelease
echo "EXIT=$? at $(date)"
ls -lh app/build/outputs/apk/release/app-release.apk 2>/dev/null || echo "NO APK"
