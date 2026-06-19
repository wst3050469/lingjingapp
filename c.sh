#!/bin/bash
echo "=== Processes ==="
ps aux | grep -E 'gradle|clang|ninja|ld.lld' | grep -v grep | wc -l
echo ""
echo "=== APK ==="
ls -lh /home/liuhui/lingjing/android/app/build/outputs/apk/release/app-release.apk 2>&1
echo ""
echo "=== Log tail ==="
tail -5 /tmp/blog.log
