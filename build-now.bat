@echo off
cd /d D:\lingjing-ide\desktop\electron
echo Running build-main...
node scripts\build-main.mjs
echo Running electron-builder...
node node_modules\electron-builder\cli.js --win --x64 --publish never
echo Done.
pause
