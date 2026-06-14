# -*- coding: utf-8 -*-
import subprocess, sys

SERVER = 'liuhui@192.168.1.9'

def ssh(cmd, timeout=30):
    r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=timeout)
    return r.returncode, r.stdout.decode('utf-8', errors='replace'), r.stderr.decode('utf-8', errors='replace')

# Check if loadPrompts is exported in dist/index.js
rc, out, err = ssh('grep "loadPrompts" /home/liuhui/lingjing/desktop/core/dist/index.js 2>&1', 10)
print('dist/index.js loadPrompts grep:', out[:200] if out.strip() else 'NOT FOUND')

# Check if there's an agent/prompts in dist/index.js
rc, out, err = ssh('grep -c "agent/prompts" /home/liuhui/lingjing/desktop/core/dist/index.js 2>&1', 10)
print('dist/index.js references to agent/prompts:', out.strip())

# Check if prompts.js content is valid
rc, out, err = ssh('head -20 /home/liuhui/lingjing/desktop/core/dist/agent/prompts.js 2>&1', 10)
print('prompts.js first lines:', out[:300])
