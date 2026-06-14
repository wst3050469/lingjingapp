# -*- coding: utf-8 -*-
import subprocess, sys, io, time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER = 'liuhui@192.168.1.9'

# Step 1: Pull latest code
print('=== Step 1: Pull latest code ===')
r = subprocess.run(
    ['ssh', SERVER, 'cd /home/liuhui/lingjing/desktop && git checkout master && git pull origin master'],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
print(r.stdout[:500])
if r.stderr:
    print('ERR:', r.stderr[:200])
if r.returncode != 0:
    print('❌ Git pull failed')
    sys.exit(1)
print('✅ Code synced\n')

# Step 2: Check current commit
r = subprocess.run(
    ['ssh', SERVER, 'cd /home/liuhui/lingjing/desktop && git log --oneline -1'],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
print(f'Now at: {r.stdout.strip()}\n')

# Step 3: Build core dist on build machine
print('=== Step 2: Build @codepilot/core ===')
r = subprocess.run(
    ['ssh', SERVER, 'cd /home/liuhui/lingjing/desktop/core && pnpm build 2>&1'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    timeout=120
)
print(r.stdout[-500:])
if r.returncode != 0:
    # Try tsc directly
    print('pnpm build failed, trying tsc...')
    r = subprocess.run(
        ['ssh', SERVER, 'cd /home/liuhui/lingjing/desktop/core && npx tsc --outDir dist 2>&1'],
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=120
    )
    print(r.stdout[:500])
    if r.returncode != 0:
        print('❌ Core build failed')
        sys.exit(1)
print('✅ Core built\n')

# Step 4: Build frontend dist
print('=== Step 3: Build frontend ===')
r = subprocess.run(
    ['ssh', SERVER, 'cd /home/liuhui/lingjing/desktop/frontend && pnpm build 2>&1'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    timeout=300
)
print(r.stdout[-500:])
if r.returncode != 0:
    print('❌ Frontend build failed')
    sys.exit(1)
print('✅ Frontend built\n')

# Step 5: Run build-main.mjs
print('=== Step 4: Run build-main.mjs ===')
r = subprocess.run(
    ['ssh', SERVER, 'cd /home/liuhui/lingjing/desktop/electron && node scripts/build-main.mjs 2>&1'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    timeout=120
)
print(r.stdout[-500:])
if r.returncode != 0:
    print('❌ build-main failed')
    sys.exit(1)
print('✅ build-main done\n')

# Step 6: Install required system packages for electron-builder on Linux
print('=== Step 5: Build Linux packages ===')
r = subprocess.run(
    ['ssh', SERVER, 'cd /home/liuhui/lingjing/desktop/electron && /home/liuhui/lingjing/desktop/electron/node_modules/.bin/electron-builder --linux --x64 --publish never 2>&1'],
    capture_output=True, text=True, encoding='utf-8', errors='replace',
    timeout=1800
)
print(r.stdout[-1000:])
if r.stderr:
    print('STDERR:', r.stderr[:500])
if r.returncode != 0:
    print(f'❌ Linux build failed (RC={r.returncode})')
    sys.exit(1)
print('✅ Linux packages built!\n')

# Step 7: List output files
print('=== Step 6: List output files ===')
r = subprocess.run(
    ['ssh', SERVER, 'ls -lh /home/liuhui/lingjing/desktop/electron/release-v17374/'],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
print(r.stdout)
