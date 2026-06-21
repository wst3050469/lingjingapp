#!/bin/bash
cd /home/liuhui/lingjing/mobile/android
export ANDROID_HOME=/home/liuhui/android-sdk
export ANDROID_SDK_ROOT=/home/liuhui/android-sdk
echo "[start] $(date)" > /home/liuhui/apk-build-v173139.log
./gradlew assembleRelease >> /home/liuhui/apk-build-v173139.log 2>&1
RC=$?
echo "[done] $(date) exit=$RC" >> /home/liuhui/apk-build-v173139.log
APK=$(find app/build/outputs/apk/ -name '*.apk' -type f 2>/dev/null | head -1)
if [ -n "$APK" ]; then
    echo "APK: $APK" >> /home/liuhui/apk-build-v173139.log
    ls -lh "$APK" >> /home/liuhui/apk-build-v173139.log 2>&1
    cp "$APK" /home/liuhui/LingJing-Mobile-1.73.139.apk
    echo 'SUCCESS' >> /home/liuhui/apk-build-v173139.log
else
    echo 'FAIL: no APK found' >> /home/liuhui/apk-build-v173139.log
    echo 'Build output directory:'
    find app/build -name '*.apk' -type f 2>/dev/null >> /home/liuhui/apk-build-v173139.log
fi
