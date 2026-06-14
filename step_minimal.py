# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout = open(1, 'w', encoding='utf-8', errors='replace', closefd=False)
except:
    pass

print('HELLO START', flush=True)

SERVER = 'liuhui@192.168.1.9'

rc, out, err = -1, '', ''
try:
    r = subprocess.run(['ssh', SERVER, 'echo 1'], capture_output=True, timeout=10)
    rc = r.returncode
    out = r.stdout.decode('utf-8', errors='replace')
except Exception as e:
    out = str(e)

print('TEST RC:', rc, 'OUT:', out.strip(), flush=True)
print('END', flush=True)
