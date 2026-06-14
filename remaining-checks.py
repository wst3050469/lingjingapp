#!/usr/bin/env python3
"""Check remaining tasks: Android APK + auto-update endpoints"""
import subprocess, os, json, urllib.request

print('=== 1. Auto-update endpoints (from within server) ===')
# Check cloud-server
r = subprocess.run(['curl', '-s', 'http://127.0.0.1:8000/api/versions/latest'], 
                   capture_output=True, text=True, timeout=5)
print(f'  :8000 (cloud-server): {r.stdout.strip()[:200]}')

# Check update-server
r = subprocess.run(['curl', '-s', 'http://127.0.0.1:3000/api/latest'], 
                   capture_output=True, text=True, timeout=5)
print(f'  :3000 (update-server): {r.stdout.strip()[:200]}')

# Check lingjing-update-server
r = subprocess.run(['curl', '-s', 'http://127.0.0.1:3002/api/latest'], 
                   capture_output=True, text=True, timeout=5)
print(f'  :3002 (lingjing-update): {r.stdout.strip()[:200]}')

print('\n=== 2. Android APK on production ===')
for f in sorted(os.listdir('/var/www/downloads/')):
    if 'android' in f.lower() or '.apk' in f.lower():
        fp = os.path.join('/var/www/downloads', f)
        print(f'  {f:50s} {os.path.getsize(fp)/1024**2:.0f} MB')

print('\n=== 3. versions.json 1.73.63 entry ===')
with open('/var/www/html/versions.json') as f:
    data = json.load(f)
entry = next((v for v in data['versions'] if v['version']=='1.73.63'), None)
if entry:
    platforms = list(entry.get('files', {}).keys())
    has_android = 'android' in platforms
    print(f'  Platforms: {platforms}')
    print(f'  Has android: {has_android}')
    if not has_android:
        print(f'  [INFO] No android APK in 1.73.63 entry - build if needed')
    else:
        print(f'  [OK] Android entry exists')

print('\n=== 4. PM2 status ===')
r = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True, timeout=5)
try:
    procs = json.loads(r.stdout)
    for p in procs:
        s = 'ok' if p.get('status') == 'online' else 'warn'
        print(f'  [{s}] {p.get("name"):25s} {p.get("status")}')
except:
    print('  PM2 not accessible')
