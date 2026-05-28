#!/bin/bash
set -e
cd /home/liuhui/lingjing/packages/electron
npx electron-builder build --linux deb --x64 --prepackaged /home/liuhui/lingjing/packages/electron/release/linux-unpacked
