# -*- coding: utf-8 -*-
import subprocess, sys, json, hashlib, os

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

BM_SERVER = 'liuhui@192.168.1.9'
PROD_SERVER = 'root@120.55.5.220'
REMOTE_DL = '/root/cloud-server/public/downloads/'
BM_DEB = '/home/liuhui/lingjing/desktop/electron/release-v17374/LingJing-1.73.73-linux-x86_64.deb'
LOCAL_DEB = r'D:\lingjing-ide\desktop\electron\release-v17374\LingJing-1.73.73-linux-x86_64.deb'

# Download from build machine
print('Downloading deb from build machine...', flush=True)
os.makedirs(os.path.dirname(LOCAL_DEB), exist_ok=True)
r = subprocess.run(['scp', f'{BM_SERVER}:{BM_DEB}', LOCAL_DEB], capture_output=True, timeout=120)
if r.returncode != 0:
    print(f'Download failed: {r.stderr.decode("utf-8", errors="replace")[:200]}', flush=True)
    sys.exit(1)
print('Downloaded ✅', flush=True)

# Upload to production server
print('Uploading deb to production server...', flush=True)
r = subprocess.run(['scp', LOCAL_DEB, f'{PROD_SERVER}:{REMOTE_DL}LingJing-1.73.73-linux-x86_64.deb'], capture_output=True, timeout=300)
if r.returncode != 0:
    print(f'Upload failed: {r.stderr.decode("utf-8", errors="replace")[:200]}', flush=True)
    sys.exit(1)
print('Uploaded ✅', flush=True)

# Compute sha512
h = hashlib.sha512()
with open(LOCAL_DEB, 'rb') as f:
    for chunk in iter(lambda: f.read(65536), b''):
        h.update(chunk)
deb_sha512 = h.hexdigest()
deb_size = os.path.getsize(LOCAL_DEB)
print(f'SHA512: {deb_sha512}', flush=True)
print(f'Size: {deb_size}', flush=True)

# Update versions.json
r = subprocess.run(['ssh', PROD_SERVER, 'cat ' + REMOTE_DL + 'versions.json'], capture_output=True, timeout=15)
current = json.loads(r.stdout.decode('utf-8', errors='replace'))

for v in current.get('versions', []):
    if v.get('version') == '1.73.73':
        if 'linux' not in v['files']:
            v['files']['linux'] = {}
        v['files']['linux']['deb'] = {
            "name": "LingJing-1.73.73-linux-x86_64.deb",
            "size": deb_size,
            "sha512": deb_sha512
        }
        break

tmp_file = r'D:\lingjing-ide\versions_v17373_final.json'
with open(tmp_file, 'w', encoding='utf-8') as f:
    json.dump(current, f, indent=2, ensure_ascii=False)

r = subprocess.run(['scp', tmp_file, f'{PROD_SERVER}:{REMOTE_DL}versions.json'], capture_output=True, timeout=15)
if r.returncode == 0:
    print('\n✅ versions.json updated with deb entry!', flush=True)
else:
    print(f'Upload failed: {r.stderr.decode("utf-8",errors="replace")[:200]}', flush=True)

# Verify
print('\n=== 最终验证 ===', flush=True)
r = subprocess.run(['ssh', PROD_SERVER, 'ls -lh ' + REMOTE_DL], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

r = subprocess.run(['ssh', PROD_SERVER, 'cat ' + REMOTE_DL + 'versions.json'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

print('\n✅ 全部完成！', flush=True)
