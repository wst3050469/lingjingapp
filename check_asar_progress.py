# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'

# Check all processes related to asar, npx, and node
r = subprocess.run(['ssh', SERVER, 'ps aux | grep -E "node.*asar|npx.*asar|electron-builder" | grep -v grep'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('Processes:', flush=True)
for line in out.split('\n') if out else ['(none)']:
    print(' ', line[:150], flush=True)

# Check CPU for the main node process  
r = subprocess.run(['ssh', SERVER, 'ps -p 3179956 -o pid,%cpu,%mem,etime,args 2>/dev/null'], capture_output=True, timeout=10)
print('\nNode process:', r.stdout.decode('utf-8', errors='replace'), flush=True)
