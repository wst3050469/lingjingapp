# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

PROD = 'root@120.55.5.220'
DL = '/root/cloud-server/public/downloads/'

# Check for Linux update files
print('=== Linux 更新文件 ===', flush=True)
r = subprocess.run(['ssh', PROD, f'ls -la {DL}latest*.yml 2>&1 || echo NO_FILES'], capture_output=True, timeout=10)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Check existing latest.yml
r = subprocess.run(['ssh', PROD, f'cat {DL}latest.yml 2>&1 || echo NOT_FOUND'], capture_output=True, timeout=10)
print('latest.yml:', flush=True)
print(r.stdout.decode('utf-8', errors='replace')[:500], flush=True)

# Check if latest-linux.yml is needed
r = subprocess.run(['ssh', PROD, f'curl -s http://localhost:3002/api/latest 2>/dev/null'], capture_output=True, timeout=10)
api_response = r.stdout.decode('utf-8', errors='replace').strip()
print(f'\nAPI /api/latest: {api_response}', flush=True)
