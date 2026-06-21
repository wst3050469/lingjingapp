#!/bin/bash
# Self-contained build monitor - writes status every 2 min
STATUS=/tmp/rebuild-status.txt
echo "Monitor started $(date)" > $STATUS

while true; do
    LINES=$(wc -l < /tmp/rebuild-out.log 2>/dev/null || echo 0)
    LAST=$(tail -1 /tmp/rebuild-out.log 2>/dev/null || echo "no-log")
    echo "$(date): $LINES lines | $LAST" >> $STATUS
    
    if grep -q "BUILD SUCCESSFUL" /tmp/rebuild-out.log 2>/dev/null; then
        echo "$(date): BUILD SUCCESSFUL!" >> $STATUS
        APK=$(find /home/liuhui/lingjing/mobile/android/app/build/outputs/apk -name "*.apk" 2>/dev/null | head -1)
        if [ -n "$APK" ]; then
            echo "APK: $APK ($(stat -c%s $APK) bytes)" >> $STATUS
        fi
        exit 0
    fi
    if grep -q "BUILD FAILED" /tmp/rebuild-out.log 2>/dev/null; then
        echo "$(date): BUILD FAILED!" >> $STATUS
        grep "FAILURE\|Error:" /tmp/rebuild-out.log | tail -10 >> $STATUS
        exit 1
    fi
    sleep 120
done
