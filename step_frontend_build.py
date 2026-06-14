# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

print('1 - starting frontend build...', flush=True)
try:
    r = subprocess.run(
        ['ssh', 'liuhui@192.168.1.9', 'cd /home/liuhui/lingjing/desktop/frontend; pnpm build 2>&1'],
        capture_output=True,
        timeout=600
    )
    print('2 - RC:', r.returncode, flush=True)
    out = r.stdout.decode('utf-8', errors='replace')
    print('3 - output length:', len(out), flush=True)
    lines = out.strip().split('\n')
    for l in lines[-3:]:
        repr_l = repr(l[:200])
        print(' ', repr_l, flush=True)
except subprocess.TimeoutExpired:
    print('TIMEOUT', flush=True)
except Exception as e:
    print('ERROR:', repr(e), flush=True)

print('DONE', flush=True)
