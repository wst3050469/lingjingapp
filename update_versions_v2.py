# -*- coding: utf-8 -*-
import subprocess, json, io, sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SERVER = 'root@120.55.5.220'
REMOTE_DL = '/root/cloud-server/public/downloads/'

versions = {
  "versions": [
    {
      "version": "1.73.73",
      "releaseDate": "2026-06-14T22:00:00.000Z",
      "description": "修复: loadPrompts模块缺失问题",
      "files": {
        "win": {
          "installer": {
            "name": "灵境 Setup 1.73.73.exe",
            "size": 194595197,
            "sha512": "ec864ea06fe3ca74c1bde5d54a5d21043683e06fb89b9af9a95429ed40592f362fe0785363bb6e6eec5f809314fe6354fc7fab11187249a0376b681bb15266f3",
            "blockMap": "灵境 Setup 1.73.73.exe.blockmap"
          },
          "portable": {
            "name": "LingJing-Portable-1.73.73-win-x64.exe",
            "size": 194253710,
            "sha512": "1ad5185d1b43ec7d2d2e141dbb60d659a6abe2e051e283b0289673a4f93abe13b1012d7d461812fe19b8dd9cec2eedc06aeb01920cd9e5b6df6a212ece6d5eba"
          }
        }
      }
    }
  ],
  "latest": "1.73.73"
}

local_path = r'D:\lingjing-ide\versions_v17373.json'
with open(local_path, 'w', encoding='utf-8') as f:
    json.dump(versions, f, indent=2, ensure_ascii=False)

r = subprocess.run(
    ['scp', local_path, f'{SERVER}:{REMOTE_DL}versions.json'],
    capture_output=True, text=True, encoding='utf-8', errors='replace'
)
if r.returncode == 0:
    print('✅ versions.json with SHA512 uploaded!')
else:
    print(f'❌ Upload failed: {r.stderr[:200]}')
