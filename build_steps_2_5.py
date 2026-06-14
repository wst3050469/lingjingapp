# -*- coding: utf-8 -*-
import subprocess, sys, os

SERVER = 'liuhui@192.168.1.9'
ELEC_DIR = '/home/liuhui/lingjing/desktop/electron'
CORE_DIR = '/home/liuhui/lingjing/desktop/core'
FRONTEND_DIR = '/home/liuhui/lingjing/desktop/frontend'

def ssh(cmd, timeout=60):
    try:
        r = subprocess.run(
            ['ssh', SERVER, cmd],
            capture_output=True,
            timeout=timeout
        )
        out = r.stdout.decode('utf-8', errors='replace')
        err = r.stderr.decode('utf-8', errors='replace')
        return r.returncode, out, err
    except subprocess.TimeoutExpired:
        return -1, '', 'TIMEOUT'
    except Exception as e:
        return -1, '', str(e)

# Step 2: Update output dir to release-v17374
print('Step 2: update output dir')
cmd = f"sed -i 's/output.*release-v[^\"]*/\"output\": \"release-v17374\"/' {ELEC_DIR}/electron-builder.json"
rc, out, err = ssh(cmd, 10)
cmd2 = f"grep output {ELEC_DIR}/electron-builder.json"
rc2, out2, err2 = ssh(cmd2, 10)
print('  Output dir:', out2.strip())

# Step 3: Build core
print('Step 3: build core')
cmd = f'cd {CORE_DIR}; npx tsc --outDir dist'
rc, out, err = ssh(cmd, 120)
print(f'  RC={rc}')
if rc != 0:
    print('  ERROR:', err.strip()[:200])
    sys.exit(1)
cmd2 = f'ls -la {CORE_DIR}/dist/agent/prompts.js'
rc2, out2, err2 = ssh(cmd2, 10)
print('  prompts.js:', out2.strip())

# Step 4: Build frontend
print('Step 4: build frontend')
cmd = f'cd {FRONTEND_DIR}; pnpm build'
rc, out, err = ssh(cmd, 600)
print(f'  RC={rc}')
if rc != 0:
    print('  ERROR:', err.strip()[:300])
    print('  Last output:', out[-500:])
    sys.exit(1)
print('  Last line:', out.strip().split('\n')[-1:])

# Step 5: Run build-main
print('Step 5: build-main.mjs')
cmd = f'cd {ELEC_DIR}; node scripts/build-main.mjs'
rc, out, err = ssh(cmd, 120)
print(f'  RC={rc}')
lines = out.strip().split('\n')
for line in lines[-5:]:
    print(' ', line)

print('\nBuild steps completed! Ready for Linux electron-builder.')
