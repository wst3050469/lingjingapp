# -*- coding: utf-8 -*-
import subprocess, sys, json

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'root@120.55.5.220'
REMOTE_DL = '/root/cloud-server/public/downloads/'
BM_SERVER = 'liuhui@192.168.1.9'
BM_APPIMAGE = '/home/liuhui/lingjing/desktop/electron/release-v17374/LingJing-1.73.73-linux-x86_64.AppImage'

# Download AppImage from build machine to local temp
print('Downloading AppImage from build machine...', flush=True)
import os
local_appimage = r'D:\lingjing-ide\desktop\electron\release-v17374\LingJing-1.73.73-linux-x86_64.AppImage'
os.makedirs(os.path.dirname(local_appimage), exist_ok=True)

r = subprocess.run(['scp', f'{BM_SERVER}:{BM_APPIMAGE}', local_appimage], capture_output=True, timeout=120)
if r.returncode == 0:
    print('Downloaded AppImage ✅', flush=True)
else:
    print(f'Download failed: {r.stderr.decode("utf-8", errors="replace")[:200]}', flush=True)
    sys.exit(1)

# Upload to production server
print('Uploading AppImage to server...', flush=True)
r = subprocess.run(['scp', local_appimage, f'{SERVER}:{REMOTE_DL}LingJing-1.73.73-linux-x86_64.AppImage'], capture_output=True, timeout=300)
if r.returncode == 0:
    print('Uploaded AppImage ✅', flush=True)
else:
    print(f'Upload failed: {r.stderr.decode("utf-8", errors="replace")[:200]}', flush=True)
    sys.exit(1)

# Compute sha512
import hashlib
h = hashlib.sha512()
with open(local_appimage, 'rb') as f:
    for chunk in iter(lambda: f.read(65536), b''):
        h.update(chunk)
appimage_sha512 = h.hexdigest()
print(f'SHA512: {appimage_sha512}', flush=True)

# Update versions.json
r = subprocess.run(['ssh', SERVER, 'cat ' + REMOTE_DL + 'versions.json'], capture_output=True, timeout=15)
current_json = r.stdout.decode('utf-8', errors='replace')
try:
    current = json.loads(current_json)
except:
    print('Failed to parse versions.json:', current_json[:200], flush=True)
    sys.exit(1)

# Add Linux entry to existing version
for v in current.get('versions', []):
    if v.get('version') == '1.73.73':
        v['files']['linux'] = {
            "AppImage": {
                "name": "LingJing-1.73.73-linux-x86_64.AppImage",
                "size": os.path.getsize(local_appimage),
                "sha512": appimage_sha512
            }
        }
        break

updated_json = json.dumps(current, indent=2, ensure_ascii=False)
tmp_file = r'D:\lingjing-ide\versions_v17373_final.json'
with open(tmp_file, 'w', encoding='utf-8') as f:
    f.write(updated_json)

# Upload
r = subprocess.run(['scp', tmp_file, f'{SERVER}:{REMOTE_DL}versions.json'], capture_output=True, timeout=15)
if r.returncode == 0:
    print('\n✅ versions.json updated with Linux AppImage entry!', flush=True)
else:
    print(f'❌ Upload failed: {r.stderr.decode("utf-8", errors="replace")[:200]}', flush=True)

print('\nDone!', flush=True)
