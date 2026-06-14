# -*- coding: utf-8 -*-
import subprocess, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER = 'liuhui@192.168.1.9'

# Check all remote URLs
r = subprocess.run(
    ['ssh', SERVER, 'cd /home/liuhui/lingjing/desktop && git remote -v'],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
print(r.stdout)
