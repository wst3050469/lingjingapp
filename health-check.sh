#!/bin/bash
echo '=== Nginx ==='
systemctl is-active nginx
echo '=== PM2 online count ==='
pm2 ls 2>&1 | grep -c 'online'
echo '=== versions.json ==='
for p in /var/www/downloads/versions.json /var/www/html/versions.json /var/www/lingjing/versions.json; do
  if [ -f "$p" ]; then echo "$p EXISTS"; else echo "$p MISSING"; fi
done
echo '=== HTTP 200 check ==='
for f in LingJing-Setup-1.73.155-win-x64.exe LingJing-Portable-1.73.155-win-x64.exe LingJing-1.73.155-linux-x86_64.AppImage LingJing-1.73.155-linux-x86_64.deb lingjing-ide-1.73.155.apk; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://www.spiritrealmz.com/downloads/$f")
  echo "$f: $code"
done
echo '=== SHA512 verify ==='
sha512sum /var/www/downloads/LingJing-Setup-1.73.155-win-x64.exe
