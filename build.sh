#!/bin/bash
cd /home/liuhui/lingjingapp/packages/electron
echo ">>> Building Linux (AppImage + deb)..."
echo ">>> This may take 5-15 minutes..."
npx electron-builder build --linux --x64 --config electron-builder.json 2>&1
echo ">>> Exit code: $?"
echo ""
echo ">>> Output:"
find release-v1500/ -maxdepth 1 -type f -ls 2>&1