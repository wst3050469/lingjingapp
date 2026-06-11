#!/bin/bash
cd /home/liuhui/lingjing-mobile
nohup bash _build_mobile.sh > /tmp/build-apk-v17233.log 2>&1 &
echo "Build started. PID=$!"
