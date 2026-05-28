#!/bin/bash
cd /home/liuhui/lingjing/packages/electron
exec npx electron-builder build --linux deb --x64 --prepackaged /home/liuhui/lingjing/packages/electron/release/linux-unpacked
