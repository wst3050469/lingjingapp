@echo off
cd /d D:\lingjing\lingjing\packages\electron
mkdir release-v1601 2>nul
npx.cmd electron-builder build --win --x64 --prepackaged release\win-unpacked -c.artifactName="LingJing-${version}-win-x64.${ext}" --config.extraMetadata.version=1.60.1 > D:\build_win2.log 2>&1
echo EXIT: %ERRORLEVEL% >> D:\build_win2.log
