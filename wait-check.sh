#!/bin/bash
sleep 300
echo "=== $(date) ==="
wc -l /tmp/rebuild-out.log
echo "--- Last 10 lines ---"
tail -10 /tmp/rebuild-out.log
echo "---"
if grep -q "BUILD SUCCESSFUL" /tmp/rebuild-out.log 2>/dev/null; then
    echo "BUILD SUCCESSFUL!"
    ls -lh /home/liuhui/lingjing/mobile/android/app/build/outputs/apk/release/*.apk 2>/dev/null
elif grep -q "BUILD FAILED" /tmp/rebuild-out.log 2>/dev/null; then
    echo "BUILD FAILED!"
    grep "FAILURE\|Error\|error:" /tmp/rebuild-out.log | tail -10
else
    echo "Build still running..."
fi
