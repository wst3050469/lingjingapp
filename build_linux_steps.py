# -*- coding: utf-8 -*-
import subprocess, sys

SERVER = 'liuhui@192.168.1.9'
ELEC_DIR = '/home/liuhui/lingjing/desktop/electron'
CORE_DIR = '/home/liuhui/lingjing/desktop/core'
FRONTEND_DIR = '/home/liuhui/lingjing/desktop/frontend'

def ssh(cmd, timeout=60):
    r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=timeout)
    return r.returncode, r.stdout.decode('utf-8', errors='replace'), r.stderr.decode('utf-8', errors='replace')

def print_result(label, rc, out, err):
    print(f'[{label}] RC={rc}')
    if out.strip(): print(out[:500])
    if err.strip(): print('ERR:', err[:200])
    return rc == 0

# Step 2: Update output dir
print('=== [2] Update output dir ===')
rc, out, err = ssh(f"sed -i 's/\"output\": \"release-v[^\"]*\"/\"output\": \"release-v17374\"/' {ELEC_DIR}/electron-builder.json")
rc2, out2, _ = ssh(f"grep output {ELEC_DIR}/electron-builder.json")
print('Output:', out2.strip())

# Step 3: Build core
print('\n=== [3] Build @codepilot/core ===')
rc, out, err = ssh(f'cd {CORE_DIR} && npx tsc --outDir dist', timeout=120)
if not print_result('core', rc, out, err):
    sys.exit(1)
# Verify prompts.js
rc2, out2, _ = ssh(f'ls -la {CORE_DIR}/dist/agent/prompts.js')
print('  prompts.js:', out2.strip())

# Step 4: Build frontend
print('\n=== [4] Build frontend ===')
rc, out, err = ssh(f'cd {FRONTEND_DIR} && pnpm build', timeout=600)
if not print_result('frontend', rc, out, err):
    sys.exit(1)

# Step 5: Run build-main
print('\n=== [5] Run build-main.mjs ===')
rc, out, err = ssh(f'cd {ELEC_DIR} && node scripts/build-main.mjs', timeout=60)
print_result('build-main', rc, out, err)
if rc != 0:
    sys.exit(1)

# Step 6: Build Linux
print('\n=== [6] Build Linux packages (20-30 min) ===')
rc, out, err = ssh(f'cd {ELEC_DIR} && {ELEC_DIR}/node_modules/.bin/electron-builder --linux --x64 --publish never', timeout=3600)
print_result('linux-builder', rc, out, err)

# Step 7: Show results
print('\n=== [7] Output files ===')
rc, out, err = ssh(f'ls -lh {ELEC_DIR}/release-v17374/')
print(out)
