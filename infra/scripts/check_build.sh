#!/bin/bash
echo "=== Build Status $(date) ==="
echo ""
echo "-- Build log tail:"
tail -15 /tmp/build-apk-v17233.log
echo ""
echo "-- Gradle processes:"
ps aux | grep -i gradle | grep -v grep | head -5
echo ""
echo "-- Log file size:"
ls -la /tmp/build-apk-v17233.log
