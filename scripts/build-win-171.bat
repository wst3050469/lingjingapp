@echo off
cd /d D:\lingjing\lingjing\packages\electron
echo [build] Starting electron-builder...
npx electron-builder build --win --x64
echo [build] Exit code: %ERRORLEVEL%
dir release\*.exe 2>nul
