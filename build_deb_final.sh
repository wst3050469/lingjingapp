#!/bin/bash
cd /home/liuhui/lingjing/packages/electron
# Build just DEB with gzip compression (avoids xz freeze)
npx electron-builder build --linux deb --x64 -c.deb.compression=gzip
echo "=== DEB Build Complete ==="
ls -lh /home/liuhui/lingjing/packages/electron/release/LingJing-1.63.0-linux-x86_64.deb
