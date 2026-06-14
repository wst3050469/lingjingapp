# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC_NM = '/home/liuhui/lingjing/desktop/electron/node_modules/@codepilot/core'

# Check if it's a symlink
r = subprocess.run(
    ['ssh', SERVER, f'ls -la {ELEC_NM} && echo --- && ls -la {ELEC_NM}/dist/agent-mode/ 2>&1 | head -5'],
    capture_output=True, timeout=10
)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
