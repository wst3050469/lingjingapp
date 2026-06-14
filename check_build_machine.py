# -*- coding: utf-8 -*-
import subprocess, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER = 'liuhui@192.168.1.9'
PROJECT_DIR = '/home/liuhui/lingjing/desktop'

# Check current git state
cmds = [
    f'cd {PROJECT_DIR} && git log --oneline -5',
    f'cd {PROJECT_DIR} && git remote -v',
    f'cd {PROJECT_DIR} && git branch -a',
]

for cmd in cmds:
    r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(f'$ {cmd}')
    print(r.stdout[:500])
    if r.stderr:
        print('ERR:', r.stderr[:200])
    print()
