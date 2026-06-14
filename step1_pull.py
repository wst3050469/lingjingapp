# -*- coding: utf-8 -*-
import subprocess, sys

SERVER = 'liuhui@192.168.1.9'

print('=== Force sync to origin/master ===')
cmds = [
    'cd /home/liuhui/lingjing/desktop && git fetch origin master',
    'cd /home/liuhui/lingjing/desktop && git reset --hard origin/master',
    'cd /home/liuhui/lingjing/desktop && git log --oneline -1',
]
for cmd in cmds:
    r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=30)
    out = r.stdout.decode('utf-8', errors='replace')
    err = r.stderr.decode('utf-8', errors='replace')
    print(f'$ {cmd.split("&&")[-1].strip()}')
    if out.strip(): print(out[:300])
    if err.strip(): print(err[:200])
    print()
