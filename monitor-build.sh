#!/bin/bash
# This script monitors the build and writes status updates
STATUS_FILE=/tmp/build-status.txt
while true; do
    if [ ! -f /tmp/build-v1.73.140.log ]; then
        echo "$(date): log not found" >> $STATUS_FILE
        sleep 30
        continue
    fi
    LINES=$(wc -l < /tmp/build-v1.73.140.log)
    LAST=$(tail -1 /tmp/build-v1.73.140.log)
    echo "$(date): $LINES lines | $LAST" >> $STATUS_FILE
    
    if grep -q "BUILD SUCCESSFUL" /tmp/build-v1.73.140.log 2>/dev/null; then
        echo "$(date): BUILD SUCCESSFUL!" >> $STATUS_FILE
        exit 0
    fi
    if grep -q "BUILD FAILED" /tmp/build-v1.73.140.log 2>/dev/null; then
        echo "$(date): BUILD FAILED!" >> $STATUS_FILE
        exit 1
    fi
    sleep 120
done
