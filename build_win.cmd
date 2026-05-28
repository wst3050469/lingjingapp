@echo off
cd /d D:\lingjing\lingjing\packages\electron
echo Starting Windows build...
npx.cmd electron-builder build --win --x64 --dir > D:\build_win_dir.log 2>&1
echo Exit code: %ERRORLEVEL% >> D:\build_win_dir.log
