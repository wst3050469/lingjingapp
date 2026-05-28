@echo off
setlocal enabledelayedexpansion

cd /d D:\lingjing\lingjing\packages\electron

REM Step 1: Build main process
echo Step 1: Build main process...
node scripts/build-main.mjs > D:\build_clean_step1.log 2>&1
if %ERRORLEVEL% NEQ 0 (
    type D:\build_clean_step1.log
    exit /b 1
)
echo main build OK

REM Step 2: Create a fresh output dir
set FRESH_DIR=D:\fresh_win_build
if exist %FRESH_DIR% rmdir /s /q %FRESH_DIR%
mkdir %FRESH_DIR%

REM Step 3: Run electron-builder with custom output
echo Step 3: Build Windows installer...
npx.cmd electron-builder build --win --x64 --projectDir=D:\lingjing\lingjing\packages\electron -c.extraMetadata.version=1.60.1 -o %FRESH_DIR% > D:\build_clean_step2.log 2>&1

echo EXIT: %ERRORLEVEL% >> D:\build_clean_step2.log
echo Done
