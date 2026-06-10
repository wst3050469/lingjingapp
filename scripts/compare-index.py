#!/usr/bin/env python3
import os, urllib.request, ssl

# Bypass SSL
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# File on disk
disk_path = '/root/lingjing/cloud-server/web-platform/public/index.html'
disk_size = os.path.getsize(disk_path)
with open(disk_path) as f:
    disk_first = f.read(500)

# Express HTTP
req = urllib.request.Request('http://127.0.0.1:8000/admin')
resp = urllib.request.urlopen(req, timeout=5)
express_body = resp.read()
express_size = len(express_body)
express_first = express_body[:500].decode('utf-8', errors='replace')

print(f"Disk size: {disk_size} bytes")
print(f"Express size: {express_size} bytes")
print(f"Match: {disk_size == express_size}")
print()
print("=== Disk first 200 ===")
print(disk_first[:200])
print()
print("=== Express first 200 ===")
print(express_first[:200])
