#!/bin/bash
cd /home/liuhui/lingjing/mobile/android
echo "Starting build at $(date)"
./gradlew assembleRelease 2>&1
RC=$?
echo "Exit code: $RC at $(date)"
ls -lh app/build/outputs/apk/release/*.apk 2>/dev/null || echo "No APK found"
