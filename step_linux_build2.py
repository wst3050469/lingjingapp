# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

ELEC = '/home/liuhui/lingjing/desktop/electron'
BUILDER = ELEC + '/node_modules/.bin/electron-builder'

print('Getting full error output...', flush=True)
r = subprocess.run(
    ['ssh', 'liuhui@192.168.1.9', f'cd {ELEC}; {BUILDER} --linux --x64 --publish never 2>&1'],
    capture_output=True, timeout=3600
)
out = r.stdout.decode('utf-8', errors='replace')
print(out[:2000], flush=True)
print('RC:', r.returncode, flush=True)
