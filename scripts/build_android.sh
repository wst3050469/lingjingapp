#!/bin/bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk

cd /home/liuhui/lingjingapp/android

echo "=== Building Android APK ==="
echo "Starting gradlew assembleRelease..."
./gradlew assembleRelease > /tmp/android_build.log 2>&1
RC=$?

echo "Exit code: $RC"
if [ $RC -eq 0 ]; then
  echo "=== APK Built Successfully ==="
  find . -name "*.apk" -ls
else
  echo "=== Build Failed ==="
  tail -30 /tmp/android_build.log
fi
echo "DONE" > /tmp/android_build_done
