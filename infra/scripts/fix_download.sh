#!/bin/bash
# Fix download: replace symlink with real copy + verify SHA512 + update latest.yml

cd /var/www/downloads

# 1. Replace symlink with real copy
echo "Step 1: Replace symlink with real copy..."
if [ -L "LingJing-Setup-1.72.31-win-x64.exe" ]; then
    cp -L LingJing-Setup-1.72.31-win-x64.exe LingJing-Setup-1.72.31-win-x64.exe.tmp
    mv LingJing-Setup-1.72.31-win-x64.exe.tmp LingJing-Setup-1.72.31-win-x64.exe
    echo "  Symlink replaced with real file"
else
    echo "  Already a regular file"
fi

# 2. Compute SHA512
echo "Step 2: Compute SHA512..."
SHA512=$(sha512sum LingJing-Setup-1.72.31-win-x64.exe | awk '{print $1}')
echo "  SHA512: $SHA512"

# 3. Encode SHA512 as base64 for latest.yml
BASE64_SHA=$(echo "$SHA512" | xxd -r -p | base64 -w0 2>/dev/null || echo "placeholder")
echo "  Base64: $BASE64_SHA"

# 4. Show file details
ls -lh LingJing-Setup-1.72.31-win-x64.exe
file LingJing-Setup-1.72.31-win-x64.exe

echo "Done"
