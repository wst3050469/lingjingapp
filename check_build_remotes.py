# -*- coding: utf-8 -*-
import subprocess, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER = 'liuhui@192.168.1.9'

# Try to fetch and check latest commit on various remotes
cmds = [
    'cd /home/liuhui/lingjing/desktop && git fetch origin 2>&1 | tail -3',
    'cd /home/liuhui/lingjing/desktop && git log --oneline origin/master -3',
    'cd /home/liuhui/lingjing/desktop && git log --oneline origin/main -3',
    'cd /home/liuhui/lingjing/desktop && git fetch gh-443 2>&1 | tail -3',
    'cd /home/liuhui/lingjing/desktop && git log --oneline gh-443/master -3',
]

for cmd in cmds:
    r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(f'$ {cmd.split("&&")[-1].strip()}')
    out = r.stdout[:300].strip()
    if out:
        print(out)
    if r.stderr[:100]:
        print('ERR:', r.stderr[:100])
    print()
