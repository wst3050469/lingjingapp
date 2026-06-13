#!/bin/bash
set -e
cd /home/liuhui/lingjing-ide/desktop/electron/release-v17229

scp "灵境 Setup 1.73.47.exe" LingJing-Portable-1.73.47-win-x64.exe latest.yml root@120.55.5.220:/var/www/downloads/

echo "Files uploaded to production"
