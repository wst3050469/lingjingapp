# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'root@120.55.5.220'
REMOTE_DL = '/root/cloud-server/public/downloads/'

# Check files on server
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + REMOTE_DL], capture_output=True, timeout=10)
print('Server downloads:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Check versions.json
r = subprocess.run(['ssh', SERVER, 'cat ' + REMOTE_DL + 'versions.json'], capture_output=True, timeout=10)
print('versions.json:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
