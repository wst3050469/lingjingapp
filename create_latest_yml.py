# -*- coding: utf-8 -*-
import subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except:
    pass

PROD = 'root@120.55.5.220'
DL = '/root/cloud-server/public/downloads/'

# Content for latest.yml (Windows electron-updater)
latest_yml = f'''version: 1.73.73
releaseDate: "2026-06-14T22:00:00.000Z"
files:
  - url: 灵境 Setup 1.73.73.exe
    sha512: ec864ea06fe3ca74c1bde5d54a5d21043683e06fb89b9af9a95429ed40592f362fe0785363bb6e6eec5f809314fe6354fc7fab11187249a0376b681bb15266f3
    size: 194595197
  - url: LingJing-Portable-1.73.73-win-x64.exe
    sha512: 1ad5185d1b43ec7d2d2e141dbb60d659a6abe2e051e283b0289673a4f93abe13b1012d7d461812fe19b8dd9cec2eedc06aeb01920cd9e5b6df6a212ece6d5eba
    size: 194253710
path: 灵境 Setup 1.73.73.exe
sha512: ec864ea06fe3ca74c1bde5d54a5d21043683e06fb89b9af9a95429ed40592f362fe0785363bb6e6eec5f809314fe6354fc7fab11187249a0376b681bb15266f3
releaseNotes: "修复: loadPrompts模块缺失问题"
'''

# Create latest.yml on server
import base64
encoded = base64.b64encode(latest_yml.encode('utf-8')).decode('ascii')

# Write using base64 decode
cmd = f'echo {encoded} | base64 -d > {DL}latest.yml'
r = subprocess.run(['ssh', PROD, cmd], capture_output=True, timeout=15)
print('latest.yml:', 'OK' if r.returncode == 0 else 'FAIL', flush=True)

# Also create latest-linux.yml for Linux updates
latest_linux_yml = f'''version: 1.73.73
releaseDate: "2026-06-14T22:00:00.000Z"
files:
  - url: LingJing-1.73.73-linux-x86_64.AppImage
    sha512: bd76cdc545728f763acd7178064d7fe492a600c5f707367321963e218e38a3c577681649fe07342bd53d2ef689dc572b37e7439839c1c6732d30db12efcec2fe
    size: 200564640
  - url: LingJing-1.73.73-linux-x86_64.deb
    sha512: 5f2e7bd7dd125ea4d40e3de600e5dcc64820356d71eb74ca8b55f665085d747071e5aacc38ddad687fddc69bc4f073ef1574b2250dfbcf69f529dbf517383513
    size: 197781260
path: LingJing-1.73.73-linux-x86_64.AppImage
sha512: bd76cdc545728f763acd7178064d7fe492a600c5f707367321963e218e38a3c577681649fe07342bd53d2ef689dc572b37e7439839c1c6732d30db12efcec2fe
releaseNotes: "修复: loadPrompts模块缺失问题"
'''

encoded2 = base64.b64encode(latest_linux_yml.encode('utf-8')).decode('ascii')
cmd2 = f'echo {encoded2} | base64 -d > {DL}latest-linux.yml'
r2 = subprocess.run(['ssh', PROD, cmd2], capture_output=True, timeout=15)
print('latest-linux.yml:', 'OK' if r2.returncode == 0 else 'FAIL', flush=True)

# Verify
r = subprocess.run(['ssh', PROD, f'ls -la {DL}latest*.yml'], capture_output=True, timeout=10)
print('\nFiles:', r.stdout.decode('utf-8', errors='replace'), flush=True)

r = subprocess.run(['ssh', PROD, f'cat {DL}latest.yml'], capture_output=True, timeout=10)
print('latest.yml:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)

r = subprocess.run(['ssh', PROD, f'cat {DL}latest-linux.yml'], capture_output=True, timeout=10)
print('latest-linux.yml:', flush=True)
print(r.stdout.decode('utf-8', errors='replace'), flush=True)
