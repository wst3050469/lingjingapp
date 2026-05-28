@echo off
cd /d D:\lingjing\lingjing\packages\electron

echo Step 1: Build main process...
node scripts\build-main.mjs > D:\build_v3_step1.log 2>&1
if %ERRORLEVEL% NEQ 0 (
    type D:\build_v3_step1.log
    exit /b 1
)
echo Main build OK

echo Step 2: Build Windows installer with fresh output dir...
npx.cmd electron-builder build --win --x64 -c.directories.output=release-v1601-win > D:\build_v3_step2.log 2>&1

echo EXIT: %ERRORLEVEL% >> D:\build_v3_step2.log
echo Done
