#!/bin/bash
echo "JAVA_HOME=$JAVA_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"
echo "java path: $(which java 2>/dev/null || echo not found)"
java -version 2>&1 | head -3
echo ""
echo "gradlew exists:"
ls -la /home/liuhui/lingjingapp/android/gradlew 2>/dev/null
echo ""
echo "ANDROID SDK:"
ls /opt/android-sdk 2>/dev/null || echo "no /opt/android-sdk"
ls /usr/lib/android-sdk 2>/dev/null || echo "no /usr/lib/android-sdk"
