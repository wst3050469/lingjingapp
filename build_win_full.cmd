@echo off
cd /d D:\lingjing\lingjing\packages\electron

REM Build-main first (compiles main process + preload)
echo === Step 1: Build main process ===
node scripts/build-main.mjs > D:\build_win_step1.log 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo BUILD-MAIN FAILED >> D:\build_win_step1.log
  exit /b 1
)

echo === Step 2: Build Windows (full) ===
npx.cmd electron-builder build --win --x64 > D:\build_win_full.log 2>&1

echo EXIT: %ERRORLEVEL% >> D:\build_win_full.log
