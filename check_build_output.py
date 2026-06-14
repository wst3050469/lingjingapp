# -*- coding: utf-8 -*-
import subprocess, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER = 'liuhui@192.168.1.9'

# Check electron-builder.json output dir
r = subprocess.run(
    ['ssh', SERVER, "grep output /home/liuhui/lingjing/desktop/electron/electron-builder.json"],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
print('Output dir:', r.stdout.strip())

# Also check if release-v17373 or 17374 exists
r = subprocess.run(
    ['ssh', SERVER, "ls -d /home/liuhui/lingjing/desktop/electron/release-v1737* 2>/dev/null || echo NONE"],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
print('Existing releases:', r.stdout.strip())
