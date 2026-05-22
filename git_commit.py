#!/usr/bin/env python3
"""Commit changes and build new version"""
import subprocess, os

os.chdir('/home/liuhui/lingjing')
USER = 'liuhui'

# Step 1: Commit
print("=== Git Add & Commit ===")
subprocess.run(['git', 'add', '-A'], capture_output=True, timeout=10)
r = subprocess.run(['git', 'commit', '-m', 'v1.51.1: fix file change auto-processing (per-file tracking) + sync mobile/app.json config'], capture_output=True, text=True, timeout=10)
print(r.stdout[:300])
print(r.stderr[:200])

# Step 2: Check the version in app.json
with open('app.json') as f:
    app_json = f.read()
import json
data = json.loads(app_json)
print(f"\napp.json version: {data.get('expo', {}).get('version', 'unknown')}")

# Step 3: Push to production bare repo
print("\n=== Push to production ===")
r2 = subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, text=True, timeout=30)
print(r2.stdout[:300])
print(r2.stderr[:300])

# Step 4: Also push to GitHub if origin exists
r3 = subprocess.run(['git', 'remote', '-v'], capture_output=True, text=True, timeout=10)
print(f"\nRemotes:\n{r3.stdout}")
