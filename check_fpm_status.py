# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Check fpm and node status
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "fpm|node.*cli" | grep -v grep'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('Processes:', flush=True)
for line in out.split('\n') if out else ['(none)']:
    print(' ', line[:150], flush=True)
