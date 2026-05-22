#!/bin/bash
cd /home/liuhui/lingjing/packages/electron
echo "Starting Linux build at $(date)"
npx electron-builder build --linux --x64 2>/tmp/electron_build_err.log
echo "Build exit code: $?"
echo "Build completed at $(date)"
ls -lh /home/liuhui/lingjing/packages/electron/release-v1511/ 2>/dev/null || echo "No release dir yet"
