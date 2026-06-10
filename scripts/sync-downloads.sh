#!/bin/bash
set -e
echo "=== Copying v1.64.44 files to /var/www/lingjing/ ==="
for f in /var/www/downloads/*1.64.44*; do
    if [ -f "$f" ]; then
        cp -v "$f" /var/www/lingjing/
    fi
done
echo "=== Also copy v1.64.43 files that are missing ==="
for f in /var/www/downloads/*1.64.43*; do
    targ="/var/www/lingjing/$(basename "$f")"
    if [ -f "$f" ] && [ ! -f "$targ" ]; then
        cp -v "$f" /var/www/lingjing/
    fi
done
echo "=== Done ==="
echo "Files for 1.64.44 in /var/www/lingjing/:"
ls /var/www/lingjing/*1.64.44* 2>/dev/null || echo "NONE"
