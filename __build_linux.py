#!/usr/bin/env python3
"""Build Linux electron packages on build machine."""
import subprocess, sys, os

project_dir = '/home/liuhui/lingjing/desktop/electron'
eb_path = '/home/liuhui/lingjing/desktop/electron/node_modules/.bin/electron-builder'

os.chdir(project_dir)

print('[Linux Build] Starting electron-builder --linux --x64...')
print(f'[Linux Build] Working dir: {os.getcwd()}')
print(f'[Linux Build] Electron-builder: {eb_path}')

result = subprocess.run(
    [eb_path, 'build', '--linux', '--x64'],
    capture_output=True,
    text=True,
    timeout=600,
    env={**os.environ, 'PATH': os.environ.get('PATH', '')}
)

print('[Linux Build] STDOUT:')
print(result.stdout)
print('[Linux Build] STDERR:')
print(result.stderr)
print(f'[Linux Build] Exit code: {result.returncode}')

sys.exit(result.returncode)
