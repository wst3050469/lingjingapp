@echo off
echo === Step 1: Build @codepilot/core (tsc) ===
cd /d D:\lingjing\lingjing\packages\core
call pnpm run build
IF %ERRORLEVEL% NEQ 0 (
    echo FAILED: core build
    pause
    exit /b 1
)

echo === Step 2: Build renderer (vite build) ===
cd /d D:\lingjing\lingjing\packages\renderer
call pnpm run build
IF %ERRORLEVEL% NEQ 0 (
    echo FAILED: renderer build
    pause
    exit /b 1
)

echo === Step 3: Build Electron main ===
cd /d D:\lingjing\lingjing\packages\electron
node scripts\build-main.mjs
IF %ERRORLEVEL% NEQ 0 (
    echo FAILED: electron main build
    pause
    exit /b 1
)

echo === Step 4: Package Windows ===
cd /d D:\lingjing\lingjing\packages\electron
call npx electron-builder build --win --x64
IF %ERRORLEVEL% NEQ 0 (
    echo FAILED: electron-builder
    pause
    exit /b 1
)

echo === BUILD COMPLETE ===
pause
