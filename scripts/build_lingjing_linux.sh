#!/bin/bash
# Linux build script for LingJing v1.64.8
set -e

cd ~/灵境

# Fetch latest from prod remote
git fetch --tags prod
git checkout main
git pull prod main

# Check current version
CUR_VERSION=$(node -e "console.log(require('./package.json').version)")
echo "Building version: $CUR_VERSION"

# Install dependencies
pnpm install --frozen-lockfile

# Build AppImage first
echo "Starting Linux AppImage build..."
npx electron-builder build --linux AppImage --x64 \
    -c.directories.output=release-v1648-linux \
    2>&1 | tail -50

# Check AppImage result
APPIMAGE=$(ls release-v1648-linux/LingJing-*.AppImage 2>/dev/null | head -1)
if [ -n "$APPIMAGE" ]; then
    echo "AppImage build SUCCESS: $APPIMAGE"
    ls -lh "$APPIMAGE"
else
    echo "AppImage build FAILED"
    ls -la release-v1648-linux/
    exit 1
fi

# Build DEB from unpacked
UNPACKED="release-v1648-linux/linux-x64-unpacked"
if [ -d "$UNPACKED" ]; then
    echo "Building DEB from prepackaged..."
    npx electron-builder build --linux deb --x64 \
        --prepackaged "$UNPACKED" \
        -c.directories.output=release-v1648-linux \
        2>&1 | tail -20
    
    DEB=$(ls release-v1648-linux/LingJing-*.deb 2>/dev/null | head -1)
    if [ -n "$DEB" ]; then
        echo "DEB build SUCCESS: $DEB"
        ls -lh "$DEB"
    else
        echo "DEB build FAILED or still in progress"
    fi
fi

echo ""
echo "=== Build Complete ==="
ls -lh release-v1648-linux/
