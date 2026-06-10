#!/usr/bin/env python3
import subprocess
result = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True)
import json
procs = json.loads(result.stdout)
for p in procs:
    if 'cloud-server' in p.get('name', ''):
        print(f"Name: {p['name']}")
        print(f"Script: {p.get('pm2_env', {}).get('pm_exec_path', 'N/A')}")
        print(f"CWD: {p.get('pm2_env', {}).get('pm_cwd', 'N/A')}")
        print(f"Args: {p.get('pm2_env', {}).get('args', [])}")
