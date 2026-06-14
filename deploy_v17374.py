# -*- coding: utf-8 -*-
import subprocess, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER = 'root@120.55.5.220'
LOCAL_DIR = r'D:\lingjing-ide\desktop\electron\release-v17374'
REMOTE_DIR = '/root/cloud-server/public/downloads/'

# Step 1: Ensure remote directory exists
r = subprocess.run(
    ['ssh', SERVER, 'mkdir -p ' + REMOTE_DIR],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
print('mkdir:', r.returncode, r.stderr[:200])

# Step 2: Upload the 3 files
files = [
    (r'灵境 Setup 1.73.73.exe', '灵境 Setup 1.73.73.exe'),
    ('LingJing-Portable-1.73.73-win-x64.exe', 'LingJing-Portable-1.73.73-win-x64.exe'),
    (r'灵境 Setup 1.73.73.exe.blockmap', '灵境 Setup 1.73.73.exe.blockmap'),
]

for local_name, remote_name in files:
    local_path = f'{LOCAL_DIR}\\{local_name}'
    remote_path = f'{REMOTE_DIR}{remote_name}'
    print(f'Uploading {local_name}...')
    r = subprocess.run(
        ['scp', local_path, f'{SERVER}:{remote_path}'],
        capture_output=True, text=True, encoding='utf-8', errors='replace'
    )
    if r.returncode == 0:
        print(f'  ✅ {local_name} uploaded')
    else:
        print(f'  ❌ Upload failed: {r.stderr[:200]}')
        sys.exit(1)

# Step 3: Check what's on server
r = subprocess.run(
    ['ssh', SERVER, f'ls -lh {REMOTE_DIR}'],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
print('\nServer files:\n', r.stdout)
