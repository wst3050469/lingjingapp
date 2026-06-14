# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Check processes in detail
r = subprocess.run(['ssh', '-oConnectTimeout=5', SERVER, 'ps aux | grep -c "tar"'], capture_output=True, timeout=15)
print('Total tar:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

r = subprocess.run(['ssh', '-oConnectTimeout=5', SERVER, 'ps aux | grep -c "ar"'], capture_output=True, timeout=15)
print('Total ar:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)

# Check CPU load
r = subprocess.run(['ssh', '-oConnectTimeout=5', SERVER, 'uptime'], capture_output=True, timeout=15)
print('Uptime:', r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
