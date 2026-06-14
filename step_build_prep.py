# -*- coding: utf-8 -*-
import subprocess, sys, io

# Force UTF-8 encoding for all output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

print('Script started', flush=True)

SERVER = 'liuhui@192.168.1.9'
ELEC = '/home/liuhui/lingjing/desktop/electron'
FRONT = '/home/liuhui/lingjing/desktop/frontend'

def ssh(cmd, timeout=60):
    try:
        r = subprocess.run(['ssh', SERVER, cmd], capture_output=True, timeout=timeout)
        return r.returncode, r.stdout.decode('utf-8', errors='replace'), r.stderr.decode('utf-8', errors='replace')
    except Exception as e:
        return -1, '', str(e)

print('Checking core dist...', flush=True)
rc, out, err = ssh('ls -la ' + ELEC + '/node_modules/@codepilot/core/dist/agent/prompts.js', 10)
print('  RC:', rc)
print('  OUT:', out.strip()[:200], flush=True)

print('Checking output dir...', flush=True)
rc, out, err = ssh('grep output ' + ELEC + '/electron-builder.json', 10)
print('  OUT:', out.strip(), flush=True)

print('Building frontend...', flush=True)
rc, out, err = ssh('cd ' + FRONT + '; pnpm build 2>&1', 600)
print('Frontend RC:', rc, flush=True)
if rc != 0:
    print('ERR:', err[-300:], flush=True)
    print('OUT:', out[-300:], flush=True)
    sys.exit(1)
lines = [l for l in out.strip().split('\n') if l.strip()]
if lines:
    for l in lines[-3:]:
        print(' ', l.encode('ascii', 'replace').decode('ascii'), flush=True)

print('Running build-main.mjs...', flush=True)
rc, out, err = ssh('cd ' + ELEC + '; node scripts/build-main.mjs 2>&1', 120)
print('build-main RC:', rc, flush=True)
lines = out.strip().split('\n')
for l in lines[-5:]:
    print(' ', l.encode('ascii', 'replace').decode('ascii'), flush=True)

if rc != 0:
    print('ERR:', err[:200], flush=True)
    sys.exit(1)

print('Ready for electron-builder --linux', flush=True)
