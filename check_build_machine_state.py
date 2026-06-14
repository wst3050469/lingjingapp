# -*- coding: utf-8 -*-
import subprocess, sys

SERVER = 'liuhui@192.168.1.9'

def ssh(cmd, timeout=30):
    try:
        r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=timeout)
        return r.returncode, r.stdout.decode('utf-8', errors='replace'), r.stderr.decode('utf-8', errors='replace')
    except Exception as e:
        return -1, '', str(e)

# Check core dist
print('core dist:')
rc, out, err = ssh('ls /home/liuhui/lingjing/desktop/core/dist/agent/prompts.js 2>&1', 10)
print(' ', out.strip())

# Check electron node_modules
print('electron node_modules/@codepilot/core:')
rc, out, err = ssh('ls /home/liuhui/lingjing/desktop/electron/node_modules/@codepilot/core/dist/index.js 2>&1', 10)
print(' ', out.strip())

# Check if dist/agent dir exists
print('core dist dirs:')
rc, out, err = ssh('ls /home/liuhui/lingjing/desktop/core/dist/ 2>&1', 10)
for line in out.strip().split('\n')[:10]:
    print(' ', line)
