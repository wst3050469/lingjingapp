#!/bin/bash
cd /home/liuhui/lingjing/desktop/electron
echo "[$(date)] Starting Linux build v1.73.86..." >> /tmp/linux-build-v17386.log
node scripts/build-main.mjs >> /tmp/linux-build-v17386.log 2>&1
npx electron-builder build --linux --x64 >> /tmp/linux-build-v17386.log 2>&1
echo "[$(date)] Linux build finished, exit code: $?" >> /tmp/linux-build-v17386.log
ls -lh release-v17386/*.AppImage release-v17386/*.deb 2>/dev/null >> /tmp/linux-build-v17386.log
