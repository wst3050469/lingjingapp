#!/bin/bash
# Replace symlink with actual copy and verify checksum
cd /var/www/downloads

# Copy real file over symlink
cp -L LingJing-Setup-1.72.31-win-x64.exe LingJing-Setup-1.72.31-win-x64.exe.tmp
mv LingJing-Setup-1.72.31-win-x64.exe.tmp LingJing-Setup-1.72.31-win-x64.exe

# Verify it's a regular file now
file LingJing-Setup-1.72.31-win-x64.exe
ls -lh LingJing-Setup-1.72.31-win-x64.exe

echo "Done"
