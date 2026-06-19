#!/bin/bash
cd /home/liuhui/lingjing/android
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=/opt/android-sdk
export NODE_ENV=production

rm -rf app/build

echo "BUILD START $(date)"
./gradlew assembleRelease
echo "BUILD END $(date) exit=$?"
ls -lh app/build/outputs/apk/release/app-release.apk 2>/dev/null
