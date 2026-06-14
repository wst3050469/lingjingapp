# -*- coding: utf-8 -*-
import subprocess, json, base64

def ssh(cmd, timeout=10):
    r = subprocess.run(['ssh', 'liuhui@192.168.1.9', cmd], capture_output=True, timeout=timeout)
    return r.returncode, r.stdout.decode('utf-8', errors='replace'), r.stderr.decode('utf-8', errors='replace')

# Use python3 on build machine to fix the json file
cmd = """python3 -c "
import json
with open('/home/liuhui/lingjing/desktop/electron/electron-builder.json', 'r') as f:
    c = json.loads(f.read().replace('\"\"output\"', '\"output\"').replace('release-v17374\"\"', 'release-v17374\"'))
c['directories']['output'] = 'release-v17374'
with open('/home/liuhui/lingjing/desktop/electron/electron-builder.json', 'w') as f:
    json.dump(c, f, indent=2, ensure_ascii=False)
print('OK:', c['directories']['output'])
" """
rc, out, err = ssh(cmd, timeout=15)
print('RC:', rc)
print('OUT:', out.strip())
print('ERR:', err.strip()[:200])
