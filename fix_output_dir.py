# -*- coding: utf-8 -*-
import subprocess, json, sys

def ssh(cmd, timeout=10):
    r = subprocess.run(['ssh', 'liuhui@192.168.1.9', cmd], capture_output=True, timeout=timeout)
    return r.returncode, r.stdout.decode('utf-8', errors='replace'), r.stderr.decode('utf-8', errors='replace')

# Read current electron-builder.json
rc, out, err = ssh('cat /home/liuhui/lingjing/desktop/electron/electron-builder.json')
if rc != 0:
    print('Failed to read file')
    sys.exit(1)

try:
    config = json.loads(out)
except:
    # Fix double-quote issue caused by earlier sed
    out_fixed = out.replace('""output"', '"output"').replace('release-v17374""', 'release-v17374"')
    config = json.loads(out_fixed)

# Set output dir
config['directories']['output'] = 'release-v17374'

# Write back - use heredoc to send the content
import tempfile, os
tmp = 'D:\\lingjing-ide\\electron-builder-tmp.json'
with open(tmp, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

with open(tmp, 'r', encoding='utf-8') as f:
    content = f.read()

# Use ssh with heredoc
import base64
encoded = base64.b64encode(content.encode('utf-8')).decode('ascii')
cmd = f'echo {encoded} | base64 -d > /home/liuhui/lingjing/desktop/electron/electron-builder.json'
rc, out, err = ssh(cmd)
print('RC:', rc)
if err.strip(): print('ERR:', err.strip())

# Verify
rc, out, err = ssh('grep output /home/liuhui/lingjing/desktop/electron/electron-builder.json')
print('Output:', out.strip())

os.remove(tmp)
