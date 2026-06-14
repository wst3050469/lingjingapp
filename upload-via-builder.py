#!/usr/bin/env python3
"""Upload ALL v1.73.63 artifacts from build machine to production server"""
import subprocess, os, glob, sys

RELEASE = '/home/liuhui/lingjing/desktop/electron/release-v17363'
PROD = 'root@120.55.5.220'
PROD_DIR = '/var/www/downloads/'
PASS = 'WsT13575967132'

# Collect files
files = []
for f in sorted(os.listdir(RELEASE)):
    fp = os.path.join(RELEASE, f)
    if not os.path.isfile(fp):
        continue
    if '73.63' in f or 'latest' in f:
        files.append((f, fp))

print(f'Uploading {len(files)} files to {PROD}:{PROD_DIR}')
for name, path in files:
    sz = os.path.getsize(path) / 1024**2
    print(f'\n--- {name} ({sz:.0f} MB) ---')
    
    # Use sshpass to handle password
    r = subprocess.run(
        ['sshpass', '-p', PASS, 'scp', '-o', 'StrictHostKeyChecking=no',
         path, f'{PROD}:{PROD_DIR}{name}'],
        timeout=600, capture_output=True, text=True
    )
    if r.returncode == 0:
        print(f'  ✅ Uploaded')
    else:
        print(f'  ❌ Failed (rc={r.returncode}): {r.stderr[:200]}')

print('\n=== VERIFY ===')
r = subprocess.run(
    ['sshpass', '-p', PASS, 'ssh', '-o', 'StrictHostKeyChecking=no', PROD,
     f'ls -lh {PROD_DIR} | grep 1.73.63'],
    timeout=10, capture_output=True, text=True
)
print(r.stdout)

# Also check latest.yml
r = subprocess.run(
    ['sshpass', '-p', PASS, 'ssh', '-o', 'StrictHostKeyChecking=no', PROD,
     f'head -5 {PROD_DIR}latest.yml'],
    timeout=10, capture_output=True, text=True
)
print(f'latest.yml:\n{r.stdout}')
