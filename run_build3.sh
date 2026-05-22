#!/bin/bash
cd /home/liuhui/lingjing/packages/electron
nohup npx electron-builder build --linux --x64 > /tmp/linux_build.log 2>&1 &
echo "BUILD LAUNCHED"
