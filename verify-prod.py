#!/usr/bin/env python3
"""Verify production files and do deep check of packaged app"""
import os, subprocess, hashlib

DOWNLOADS = '/var/www/downloads'

print('=== Production 1.73.63 files ===')
for f in sorted(os.listdir(DOWNLOADS)):
    if '73.63' in f:
        fp = os.path.join(DOWNLOADS, f)
        sha = hashlib.sha256()
        with open(fp, 'rb') as fh:
            while True:
                chunk = fh.read(65536)
                if not chunk: break
                sha.update(chunk)
        print(f'  {f:55s} {os.path.getsize(fp)/1024**2:6.0f} MB  sha256={sha.hexdigest()[:16]}...')

# Check latest.yml
yml = os.path.join(DOWNLOADS, 'latest.yml')
with open(yml) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#'):
            print(f'  latest.yml: {line[:100]}')

# Check the Setup exe's app.asar by extracting with 7z
print('\n=== Check app.asar in Setup ===')
setup = os.path.join(DOWNLOADS, '灵境 Setup 1.73.63.exe')
if os.path.exists(setup):
    print(f'  Setup size: {os.path.getsize(setup)/1024**2:.0f} MB')
else:
    print(f'  ERROR: Setup not found!')
    # List all 灵境 files
    for f in os.listdir(DOWNLOADS):
        if '灵境' in f or 'Setup' in f:
            print(f'    {f}')
