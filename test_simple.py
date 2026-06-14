# -*- coding: utf-8 -*-
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

print("A", flush=True)
r = subprocess.run(['ssh', 'liuhui@192.168.1.9', 'echo hello'], capture_output=True, timeout=30)
print("B", r.returncode, flush=True)
print("C", r.stdout.decode('utf-8', errors='replace').strip(), flush=True)
print("D", flush=True)
