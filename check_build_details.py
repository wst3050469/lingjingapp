# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'

# Detailed process info
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "3179955" | grep -v grep'], capture_output=True, timeout=10)
print('Process 3179955:', r.stdout.decode('utf-8', errors='replace')[:300], flush=True)

# Check child processes
r = subprocess.run(['ssh', SERVER, 'pstree -ap 3179955 2>/dev/null || ps --ppid 3179955 2>/dev/null || echo "no pstree"'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('Children:', out[:200] if out else '(none)', flush=True)

# Check if node process exists
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "cli.js" | grep -v grep'], capture_output=True, timeout=10)
out = r.stdout.decode('utf-8', errors='replace').strip()
print('\ncli.js processes:')
for line in out.split('\n') if out else []:
    print(' ', line[:150], flush=True)
