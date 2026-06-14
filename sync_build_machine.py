# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

LOCAL_ELEC = 'D:/lingjing-ide/desktop/electron'
LOCAL_FRONT = 'D:/lingjing-ide/desktop/frontend'
BM_ELEC = 'liuhui@192.168.1.9:/home/liuhui/lingjing/desktop/electron'
BM_FRONT = 'liuhui@192.168.1.9:/home/liuhui/lingjing/desktop/frontend'
BM_CORE = 'liuhui@192.168.1.9:/home/liuhui/lingjing/desktop/core'

# Sync electron dist (main.js + preload.js)
print('Syncing electron/dist/...', flush=True)
r = subprocess.run(
    ['scp', '-r', LOCAL_ELEC + '/dist/', BM_ELEC + '/dist/'],
    capture_output=True, timeout=30
)
print('  RC:', r.returncode, flush=True)

# Sync prompt files
print('Syncing electron/prompts/...', flush=True)
r = subprocess.run(
    ['scp', '-r', LOCAL_ELEC + '/prompts/', BM_ELEC + '/prompts/'],
    capture_output=True, timeout=30
)
print('  RC:', r.returncode, flush=True)

# Sync core dist
print('Syncing core/dist/...', flush=True)
r = subprocess.run(
    ['scp', '-r', LOCAL_ELEC.replace('electron', 'core') + '/dist/', BM_CORE + '/dist/'],
    capture_output=True, timeout=30
)
print('  RC:', r.returncode, flush=True)

# Sync @codepilot/core in electron node_modules
print('Syncing electron/node_modules/@codepilot/core...', flush=True)
r = subprocess.run(
    ['scp', '-r', 
     LOCAL_ELEC + '/node_modules/@codepilot/core/dist/', 
     BM_ELEC + '/node_modules/@codepilot/core/dist/'],
    capture_output=True, timeout=30
)
print('  RC:', r.returncode, flush=True)

# Verify on build machine
print('\nVerifying on build machine...', flush=True)
r = subprocess.run(
    ['ssh', 'liuhui@192.168.1.9', 
     'ls -la /home/liuhui/lingjing/desktop/electron/dist/main.js /home/liuhui/lingjing/desktop/core/dist/agent/prompts.js'],
    capture_output=True, timeout=10
)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

print('\nReady for electron-builder --linux!', flush=True)
