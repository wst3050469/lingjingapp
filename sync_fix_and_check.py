# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'
LOCAL_HOOK = 'D:/lingjing-ide/desktop/electron/scripts/after-pack-hook.cjs'
REMOTE_HOOK = f'{SERVER}:{ELEC}/scripts/after-pack-hook.cjs'

# Check current build progress
r = subprocess.run(['ssh', SERVER, 'ls -lh ' + ELEC + '/release-v17374/'], capture_output=True, timeout=10)
print('Current release:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

# Check if process still running
r = subprocess.run(['ssh', SERVER, 'ps aux | grep "electron-builder" | grep -v grep | head -1'], capture_output=True, timeout=10)
running = r.stdout.decode('utf-8', errors='replace').strip()
if not running:
    print('BUILD COMPLETED!', flush=True)
    r = subprocess.run(['ssh', SERVER, 'tail -5 ' + ELEC + '/linux-build3.log'], capture_output=True, timeout=10)
    print(r.stdout.decode('utf-8', errors='replace'), flush=True)
else:
    print('Build still running:', running[:100], flush=True)

# Sync the fixed hook file  
print('\nSyncing fixed after-pack-hook.cjs...', flush=True)
r = subprocess.run(['scp', LOCAL_HOOK, REMOTE_HOOK], capture_output=True, timeout=10)
print('SCP result:', 'OK' if r.returncode == 0 else 'FAIL', flush=True)
