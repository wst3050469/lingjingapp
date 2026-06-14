# -*- coding: utf-8 -*-
import subprocess, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

SERVER = 'liuhui@192.168.1.9'
ELEC_DIR = '/home/liuhui/lingjing/desktop/electron'
CORE_DIR = '/home/liuhui/lingjing/desktop/core'
FRONTEND_DIR = '/home/liuhui/lingjing/desktop/frontend'

def ssh_run(cmd, timeout=60):
    """Run SSH command and return (returncode, stdout, stderr)"""
    r = subprocess.run(
        ['ssh', SERVER, cmd],
        capture_output=True, timeout=timeout
    )
    # Manual decode with replace
    stdout = r.stdout.decode('utf-8', errors='replace')
    stderr = r.stderr.decode('utf-8', errors='replace')
    return r.returncode, stdout, stderr

# Step 1: Pull latest code
print('=== [1/6] Pull latest code ===')
rc, out, err = ssh_run(f'cd {ELEC_DIR}/.. && git checkout master && git pull origin master', timeout=30)
print(out[:500])
if err:
    print('ERR:', err[:200])

rc2, out2, _ = ssh_run(f'cd {ELEC_DIR}/.. && git log --oneline -1', timeout=10)
print('Now at:', out2.strip())

# Step 2: Update electron-builder.json output dir
print('\n=== [2/6] Update output dir ===')
rc, out, err = ssh_run(f"sed -i 's/\"output\": \"release-v[^\"]*\"/\"output\": \"release-v17374\"/' {ELEC_DIR}/electron-builder.json", timeout=10)
rc2, out2, _ = ssh_run(f"grep output {ELEC_DIR}/electron-builder.json", timeout=10)
print('Output:', out2.strip())

# Step 3: Build core
print('\n=== [3/6] Build @codepilot/core ===')
rc, out, err = ssh_run(f'cd {CORE_DIR} && npx tsc --outDir dist', timeout=120)
if rc != 0:
    print('❌ Core build failed')
    print(err[:300])
    print(out[:300])
    sys.exit(1)
print('✅ Core built')
# Verify prompts.js exists
rc2, out2, _ = ssh_run(f'ls -la {CORE_DIR}/dist/agent/prompts.js', timeout=10)
print('  prompts.js:', out2.strip())

# Step 4: Build frontend
print('\n=== [4/6] Build frontend ===')
rc, out, err = ssh_run(f'cd {FRONTEND_DIR} && pnpm build', timeout=600)
if rc != 0:
    print('❌ Frontend build failed')
    print(err[:500])
    print(out[-500:])
    sys.exit(1)
print('✅ Frontend built')

# Step 5: Run build-main
print('\n=== [5/6] Run build-main.mjs ===')
rc, out, err = ssh_run(f'cd {ELEC_DIR} && node scripts/build-main.mjs', timeout=60)
if rc != 0:
    print('❌ build-main failed')
    print(err[:300])
    sys.exit(1)
# Show last few lines of output
lines = out.strip().split('\n')
for line in lines[-5:]:
    print(' ', line)

# Step 6: Build Linux packages
print('\n=== [6/6] Build Linux packages ===')
print('(this takes 20-30 minutes...)')
rc, out, err = ssh_run(f'cd {ELEC_DIR} && {ELEC_DIR}/node_modules/.bin/electron-builder --linux --x64 --publish never', timeout=3600)
if rc != 0:
    print('❌ Linux build failed')
    print(err[:1000])
    print(out[-1000:])
    sys.exit(1)
print('✅ Linux packages built!')
print('\n--- Last 1000 chars of output ---')
print(out[-1000:])
