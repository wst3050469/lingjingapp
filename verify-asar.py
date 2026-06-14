#!/usr/bin/env python3
"""Verify app.asar from new v1.73.63 build"""
import os, subprocess

asar_base = '/home/liuhui/lingjing/desktop/electron/release-v17363/win-unpacked/resources'

# Check app.asar
asar = os.path.join(asar_base, 'app.asar')
print(f'app.asar: {os.path.getsize(asar)/1024**2:.0f} MB')

# Check unpacked dir
unpacked = asar + '.unpacked'
if os.path.exists(unpacked):
    print(f'app.asar.unpacked: EXISTS')
    # Check for @codepilot/core
    core_dist = os.path.join(unpacked, 'node_modules', '@codepilot', 'core', 'dist')
    if os.path.exists(core_dist):
        print(f'@codepilot/core/dist: EXISTS')
        # Check key files
        for f in ['index.js', 'utils/logger.js', 'agent/agent.js']:
            fp = os.path.join(core_dist, f)
            exists = os.path.exists(fp)
            print(f'  {f}: {"YES" if exists else "MISSING!"} ({os.path.getsize(fp) if exists else 0})')
        
        # List all subdirs in dist
        print(f'\n  Dist subdirs:')
        for item in sorted(os.listdir(core_dist)):
            if os.path.isdir(os.path.join(core_dist, item)):
                print(f'    {item}/')
        
        # Check package.json
        pkg = os.path.join(unpacked, 'node_modules', '@codepilot', 'core', 'package.json')
        if os.path.exists(pkg):
            import json
            with open(pkg) as f:
                data = json.load(f)
            print(f'\n  package.json: type={data.get("type")}, private={data.get("private")}, version={data.get("version")}')
    else:
        print('ERROR: @codepilot/core/dist missing from unpacked!')
else:
    print('ERROR: app.asar.unpacked not found')
    # Check what IS there
    for item in sorted(os.listdir(asar_base)):
        print(f'  {item}')
