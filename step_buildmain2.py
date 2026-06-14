# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

print('Running build-main.mjs (full output)...', flush=True)
try:
    r = subprocess.run(
        ['ssh', 'liuhui@192.168.1.9', 'cd /home/liuhui/lingjing/desktop/electron; node scripts/build-main.mjs 2>&1'],
        capture_output=True,
        timeout=120
    )
    print('RC:', r.returncode, flush=True)
    out = r.stdout.decode('utf-8', errors='replace')
    print('FULL OUTPUT:')
    print(out[:2000], flush=True)
    if r.returncode != 0:
        print('\nSTDERR:', r.stderr.decode('utf-8', errors='replace')[:500], flush=True)
except Exception as e:
    print('EXCEPTION:', repr(e), flush=True)

print('DONE', flush=True)
