# -*- coding: utf-8 -*-
import subprocess

def ssh(cmd, timeout=60):
    try:
        r = subprocess.run(['ssh', 'liuhui@192.168.1.9', cmd], capture_output=True, timeout=timeout)
        return r.returncode, r.stdout.decode('utf-8', errors='replace'), r.stderr.decode('utf-8', errors='replace')
    except subprocess.TimeoutExpired:
        return -1, '', 'TIMEOUT'
    except Exception as e:
        return -1, '', str(e)

print(ssh('cd /home/liuhui/lingjing/desktop/core; npx tsc --outDir dist', 120))
