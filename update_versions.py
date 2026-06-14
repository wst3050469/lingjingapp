# -*- coding: utf-8 -*-
import subprocess, json, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER = 'root@120.55.5.220'
REMOTE_DL = '/root/cloud-server/public/downloads/'

# Read current versions.json
r = subprocess.run(
    ['ssh', SERVER, f'cat {REMOTE_DL}versions.json'],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)

current = {}
if r.returncode == 0 and r.stdout.strip():
    try:
        current = json.loads(r.stdout)
        print('Current versions.json:', json.dumps(current, indent=2, ensure_ascii=False))
    except:
        print('Failed to parse existing versions.json')

# Create new version entry
new_version = {
    "version": "1.73.73",
    "releaseDate": "2026-06-14T22:00:00.000Z",
    "description": "修复: loadPrompts模块缺失问题",
    "files": {
        "win": {
            "installer": {
                "name": "灵境 Setup 1.73.73.exe",
                "size": 194595197,
                "sha512": "",
                "blockMap": "灵境 Setup 1.73.73.exe.blockmap"
            },
            "portable": {
                "name": "LingJing-Portable-1.73.73-win-x64.exe",
                "size": 194253710,
                "sha512": ""
            }
        }
    }
}

# Update versions array
if 'versions' not in current:
    current['versions'] = []

# Remove old 1.73.73 entry if exists
current['versions'] = [v for v in current['versions'] if v.get('version') != '1.73.73']
current['versions'].insert(0, new_version)

# Optionally set latest
current['latest'] = "1.73.73"

updated_json = json.dumps(current, indent=2, ensure_ascii=False)

# Write to temp file, then scp to server
tmp_local = r'D:\lingjing-ide\versions_v17373.json'
with open(tmp_local, 'w', encoding='utf-8') as f:
    f.write(updated_json)

print('\nNew versions.json:', updated_json)

# Upload
r = subprocess.run(
    ['scp', tmp_local, f'{SERVER}:{REMOTE_DL}versions.json'],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
if r.returncode == 0:
    print('\n✅ versions.json uploaded!')
else:
    print(f'\n❌ Upload failed: {r.stderr[:200]}')
