#!/bin/bash
exec 
cd /home/liuhui/lingjing/packages/electron
exec npx electron-builder build --linux --x64
